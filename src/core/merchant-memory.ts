// src/core/merchant-memory.ts
// ============================================================
// 商户记忆：商户键 → 分类
//
// 只从「可信来源」学：
//   1. 用户手设的分类（categorySource === 'manual'）
//   2. 关键词命中的分类（categorySource === 'auto' 且能匹配到品类词）
// 推测（guessed）、待确认、渠道推断一律不学——猜的东西不能固化成记忆。
//
// 同一商户键有两种分类 → 视为冲突，查询返回 { conflict: true }，调用方判「待确认」。
// 记忆不落库：每次由交易数据现算，永远与最新数据一致。
// ============================================================

import type { Transaction } from '@/types';
import { extractMerchantKey } from './merchant-key';
import { classifyByKeyword } from './keyword-match';

export type MerchantMemory = ReadonlyMap<string, { category: string; conflict: boolean }>;

/** 从交易数据构建记忆。excludeId 用于留一法验证。 */
export function buildMerchantMemory(
  transactions: Transaction[],
  options: { excludeId?: string } = {},
): MerchantMemory {
  const counts = new Map<string, Map<string, number>>();

  for (const txn of transactions) {
    if (options.excludeId && txn.id === options.excludeId) continue;
    const key = extractMerchantKey(txn);
    if (!key) continue;

    let category: string | null = null;
    if (txn.categorySource === 'manual') {
      category = txn.category;
    } else if (txn.categorySource === 'auto') {
      const hit = classifyByKeyword(txn);
      category = hit?.category ?? null;
    }
    if (!category || category === '待确认') continue;

    const bucket = counts.get(key) ?? new Map<string, number>();
    bucket.set(category, (bucket.get(category) ?? 0) + 1);
    counts.set(key, bucket);
  }

  const memory = new Map<string, { category: string; conflict: boolean }>();
  for (const [key, bucket] of counts) {
    const sorted = [...bucket.entries()].sort((a, b) => b[1] - a[1]);
    if (sorted.length > 1) {
      // 同一商户出现过两种分类：标记冲突，查询时判「待确认」，不做多数投票
      memory.set(key, { category: sorted[0][0], conflict: true });
    } else {
      memory.set(key, { category: sorted[0][0], conflict: false });
    }
  }
  return memory;
}

/** 查询记忆：命中返回分类；冲突返回 conflict；没有返回 null */
export function lookupMerchantMemory(
  memory: MerchantMemory,
  key: string | null,
): { category: string } | { conflict: true } | null {
  if (!key) return null;
  const entry = memory.get(key);
  if (!entry) return null;
  if (entry.conflict) return { conflict: true };
  return { category: entry.category };
}
