// ============================================================
// 封面图独立存储 - 把 base64 图片从交易主记录里拆出来
//
// 背景：封面图以 data URL 形式内嵌在 Transaction 上，而 Store 每次改动都会
// 把整个交易数组序列化写一遍。攒上几十张图，每次改个分类都要序列化几 MB，
// 而且很容易顶到 localStorage 的配额上限。
//
// 现在图片单独存 `pfd_cover_<id>`：内存里照旧挂在 coverImage 上（UI 不用改），
// 写盘前剥离、读盘后合并。
// ============================================================

import type { Transaction } from '@/types';
import { storage, type StorageAdapter } from '@/storage/StorageAdapter';

export const COVER_KEY_PREFIX = 'pfd_cover_';

export function coverKey(id: string): string {
  return `${COVER_KEY_PREFIX}${id}`;
}

function idFromCoverKey(key: string): string {
  return key.slice(COVER_KEY_PREFIX.length);
}

/** 把主记录里内嵌的 base64 挪到独立键；没有封面的记录原样返回 */
export async function migrateInlineCovers(
  transactions: Transaction[],
  store: StorageAdapter = storage,
): Promise<Transaction[]> {
  const withCover = transactions.filter((t) => t.coverImage);
  if (withCover.length === 0) return transactions;

  const migratedIds = new Set<string>();
  for (const txn of withCover) {
    await store.set(coverKey(txn.id), txn.coverImage);
    migratedIds.add(txn.id);
  }

  return transactions.map((t) => (migratedIds.has(t.id) ? { ...t, coverImage: '' } : t));
}

/** 从独立键读回图片并挂回 coverImage */
export async function hydrateCovers(
  transactions: Transaction[],
  store: StorageAdapter = storage,
): Promise<Transaction[]> {
  const keys = (await store.keys()).filter((k) => k.startsWith(COVER_KEY_PREFIX));
  if (keys.length === 0) return transactions;

  const covers = new Map<string, string>();
  for (const key of keys) {
    const value = await store.get<string>(key);
    if (typeof value === 'string' && value) covers.set(idFromCoverKey(key), value);
  }

  return transactions.map((t) => {
    const cover = covers.get(t.id);
    return cover && t.coverImage !== cover ? { ...t, coverImage: cover } : t;
  });
}

/** 保存/清除单条封面（空字符串表示删除） */
export async function saveCover(
  id: string,
  dataUrl: string,
  store: StorageAdapter = storage,
): Promise<void> {
  if (dataUrl) {
    await store.set(coverKey(id), dataUrl);
  } else {
    await store.remove(coverKey(id));
  }
}

/** 剥离内存里的图片，得到可以写盘的主数组 */
export function stripCovers(transactions: Transaction[]): Transaction[] {
  return transactions.some((t) => t.coverImage)
    ? transactions.map((t) => (t.coverImage ? { ...t, coverImage: '' } : t))
    : transactions;
}
