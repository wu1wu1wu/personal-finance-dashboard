// ============================================================
// 备份模块 - 导出 / 校验 / 恢复（带回滚）/ 恢复前快照
//
// 这一层是纯逻辑：只依赖一个最小的存储接口，方便单测注入假存储。
// 目标：备份文件坏掉时不能把本机数据一起带坏，恢复失败必须能退回原样。
// ============================================================

import { STORAGE_KEYS } from '@/types';

export const BACKUP_VERSION = '1.0';

/** 恢复前自动快照的键前缀 */
export const SNAPSHOT_PREFIX = 'pfd_snapshot_';

/** 保留最近几份快照 */
export const MAX_SNAPSHOTS = 3;

/** 备份模块需要的最小存储能力（StorageAdapter 结构上满足） */
export interface BackupStorage {
  get<T>(key: string): Promise<T | null>;
  set<T>(key: string, value: T): Promise<void>;
  remove(key: string): Promise<void>;
  keys(): Promise<string[]>;
}

export interface BackupFile {
  _meta: {
    version: string;
    exportTime: string;
    keys: string[];
  };
  [key: string]: unknown;
}

export type ValidateResult =
  | { ok: true; keys: string[] }
  | { ok: false; error: string };

/** 每个键期望的结构；不匹配就判定备份损坏 */
const EXPECTED_SHAPE: Record<string, 'array' | 'object'> = {
  [STORAGE_KEYS.TRANSACTIONS]: 'array',
  [STORAGE_KEYS.CUSTOM_RULES]: 'array',
  [STORAGE_KEYS.BUDGETS]: 'array',
  [STORAGE_KEYS.CAPTURE_RULES]: 'array',
  [STORAGE_KEYS.TOTAL_BUDGETS]: 'object',
  [STORAGE_KEYS.CATEGORY_FEEDBACK]: 'object',
  [STORAGE_KEYS.CAPTURE_SETTINGS]: 'object',
};

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** 判断这份备份能不能用；只接受 pfd_ 前缀、结构正确的键 */
export function validateBackup(raw: unknown): ValidateResult {
  if (!isPlainObject(raw)) return { ok: false, error: '备份文件内容不是对象' };
  if (!isPlainObject(raw._meta)) return { ok: false, error: '无效的备份文件格式（缺少 _meta）' };

  const meta = raw._meta;
  if (meta.version !== BACKUP_VERSION) {
    return { ok: false, error: `不支持的备份版本：${String(meta.version)}` };
  }
  if (!Array.isArray(meta.keys)) {
    return { ok: false, error: '备份文件的 keys 不是数组' };
  }

  const keys: string[] = [];
  for (const key of meta.keys) {
    if (typeof key !== 'string') return { ok: false, error: '备份文件里有非法的键名' };
    // 只认本应用的键，别让一个手工改过的文件往存储里写任意内容
    if (!key.startsWith('pfd_') || key.startsWith(SNAPSHOT_PREFIX)) continue;
    if (raw[key] === undefined) continue;

    const expected = EXPECTED_SHAPE[key];
    const value = raw[key];
    if (expected === 'array' && !Array.isArray(value)) {
      return { ok: false, error: `备份里 ${key} 的结构不对（应为数组）` };
    }
    if (expected === 'object' && !isPlainObject(value)) {
      return { ok: false, error: `备份里 ${key} 的结构不对（应为对象）` };
    }
    keys.push(key);
  }

  return { ok: true, keys };
}

/** 导出：读取所有 pfd_ 键（不含历史快照） */
export async function buildBackup(store: BackupStorage): Promise<BackupFile> {
  const all = await store.keys();
  const keys = all.filter((k) => k.startsWith('pfd_') && !k.startsWith(SNAPSHOT_PREFIX));

  const backup: BackupFile = {
    _meta: {
      version: BACKUP_VERSION,
      exportTime: new Date().toISOString(),
      keys,
    },
  };
  for (const key of keys) {
    const value = await store.get(key);
    if (value !== null) backup[key] = value;
  }
  return backup;
}

export interface RestoreResult {
  ok: boolean;
  restored: number;
  error?: string;
}

/**
 * 恢复：逐键写入，任一键失败就把已经写过的键还原回原值。
 * 不做事务的后果是"一半新数据一半旧数据"，比恢复失败更糟。
 */
export async function restoreBackup(raw: unknown, store: BackupStorage): Promise<RestoreResult> {
  const validated = validateBackup(raw);
  if (!validated.ok) return { ok: false, restored: 0, error: validated.error };

  const backup = raw as BackupFile;
  const previous = new Map<string, unknown>();
  const written: string[] = [];

  for (const key of validated.keys) {
    previous.set(key, await store.get(key));
  }

  try {
    for (const key of validated.keys) {
      await store.set(key, backup[key]);
      written.push(key);
    }
  } catch (e) {
    for (const key of written) {
      const old = previous.get(key);
      if (old === null || old === undefined) {
        await store.remove(key);
      } else {
        await store.set(key, old);
      }
    }
    return {
      ok: false,
      restored: 0,
      error: e instanceof Error ? e.message : '恢复失败',
    };
  }

  return { ok: true, restored: written.length };
}

/** 恢复前把当前数据存成快照，只保留最近 MAX_SNAPSHOTS 份 */
export async function snapshotCurrent(
  store: BackupStorage,
  timestamp = new Date().toISOString(),
): Promise<void> {
  const file = await buildBackup(store);
  await store.set(`${SNAPSHOT_PREFIX}${timestamp}`, file);

  const snapshots = (await store.keys())
    .filter((k) => k.startsWith(SNAPSHOT_PREFIX))
    .sort();
  const stale = snapshots.slice(0, Math.max(0, snapshots.length - MAX_SNAPSHOTS));
  for (const key of stale) {
    await store.remove(key);
  }
}
