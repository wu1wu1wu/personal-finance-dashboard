// ============================================================
// 最近删除（回收站）- 纯逻辑
//
// 删除先入这里，用户可以从底部撤销条或设置页找回来。
// 只保留最近若干批、若干天、且总笔数有上限：回收站和封面图共用同一份
// localStorage / Preferences 配额，不能因为"多留点保险"把存储吃满。
// ============================================================

import type { Budget, Transaction } from '@/types';
import { generateId } from '@/utils/id';

/** 最多保留多少批删除记录 */
export const TRASH_MAX_BATCHES = 20;
/** 最多保留多少天 */
export const TRASH_TTL_MS = 30 * 24 * 60 * 60 * 1000;
/** 回收站里的交易总笔数上限 */
export const TRASH_MAX_TRANSACTIONS = 500;

export type TrashReason = 'single' | 'months';

export interface TrashEntry {
  id: string;
  /** ISO 时间戳 */
  deletedAt: string;
  reason: TrashReason;
  /** 展示用标签，如「美团」或「8 月、9 月」 */
  label: string;
  transactions: Transaction[];
  /** 按月份清理时连带的预算 */
  budgets?: Budget[];
  totalBudgets?: Record<string, number>;
}

export interface TrashEntryInput {
  id?: string;
  reason: TrashReason;
  label: string;
  transactions: Transaction[];
  budgets?: Budget[];
  totalBudgets?: Record<string, number>;
  now?: Date;
}

export function createTrashEntry(input: TrashEntryInput): TrashEntry {
  const now = input.now ?? new Date();
  return {
    id: input.id ?? generateId(`trash-${now.getTime()}-${Math.random()}`),
    deletedAt: now.toISOString(),
    reason: input.reason,
    label: input.label,
    transactions: input.transactions,
    ...(input.budgets ? { budgets: input.budgets } : {}),
    ...(input.totalBudgets ? { totalBudgets: input.totalBudgets } : {}),
  };
}

export interface PruneResult {
  entries: TrashEntry[];
  /** 被淘汰的批次：调用方负责清掉它们的封面图 */
  dropped: TrashEntry[];
}

export function trashTransactionCount(entries: TrashEntry[]): number {
  return entries.reduce((sum, entry) => sum + entry.transactions.length, 0);
}

/**
 * 剪枝：按「时间倒序 → 30 天 → 20 批 → 500 笔」依次收敛。
 * 单批就超过总笔数上限时保留但截断，部分可撤销好过一点都撤不回来。
 */
export function pruneTrash(entries: TrashEntry[], now: Date = new Date()): PruneResult {
  const dropped: TrashEntry[] = [];
  let kept = [...entries].sort((a, b) => b.deletedAt.localeCompare(a.deletedAt));

  // 1. 过期
  const fresh = kept.filter((entry) => {
    const age = now.getTime() - new Date(entry.deletedAt).getTime();
    const expired = !Number.isFinite(age) || age > TRASH_TTL_MS;
    if (expired) dropped.push(entry);
    return !expired;
  });
  kept = fresh;

  // 2. 批数上限
  if (kept.length > TRASH_MAX_BATCHES) {
    dropped.push(...kept.slice(TRASH_MAX_BATCHES));
    kept = kept.slice(0, TRASH_MAX_BATCHES);
  }

  // 3. 总笔数上限：从最新往旧累加
  const result: TrashEntry[] = [];
  let used = 0;
  for (const entry of kept) {
    const count = entry.transactions.length;
    if (used + count <= TRASH_MAX_TRANSACTIONS) {
      result.push(entry);
      used += count;
      continue;
    }

    const remaining = TRASH_MAX_TRANSACTIONS - used;
    if (remaining <= 0) {
      dropped.push(entry);
      continue;
    }
    // 这一批单独就超上限：截断保留
    result.push({ ...entry, transactions: entry.transactions.slice(0, remaining) });
    used += remaining;
  }

  return { entries: result, dropped };
}

/** 追加一批并顺手剪枝 */
export function addTrashEntry(
  entries: TrashEntry[],
  entry: TrashEntry,
  now: Date = new Date(),
): PruneResult {
  return pruneTrash([entry, ...entries], now);
}

/** 撤销：按 id 合并，已存在的跳过（用户可能在删除后重新导入过同一笔） */
export function restoreTransactions(entry: TrashEntry, existing: Transaction[]): Transaction[] {
  const existingIds = new Set(existing.map((t) => t.id));
  const restored = entry.transactions.filter((t) => !existingIds.has(t.id));
  return [...restored, ...existing];
}

/** 撤销：预算按 分类+月份 去重 */
export function restoreBudgets(entry: TrashEntry, existing: Budget[]): Budget[] {
  const budgets = entry.budgets ?? [];
  if (budgets.length === 0) return existing;

  const existingKeys = new Set(existing.map((b) => `${b.category}::${b.month}`));
  const restored = budgets.filter((b) => !existingKeys.has(`${b.category}::${b.month}`));
  return [...existing, ...restored];
}

/** 撤销：总预算只补回缺失的月份，不覆盖现有设置 */
export function restoreTotalBudgets(
  entry: TrashEntry,
  existing: Record<string, number>,
): Record<string, number> {
  const totals = entry.totalBudgets ?? {};
  const merged = { ...existing };
  for (const [month, amount] of Object.entries(totals)) {
    if (merged[month] === undefined) merged[month] = amount;
  }
  return merged;
}
