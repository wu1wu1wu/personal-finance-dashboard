// src/core/classify-context.ts
// ============================================================
// 分类上下文构建：从交易数据算出记忆、时段金额规则、渠道统计。
//
// 三者都不落库，每次现算——永远和最新数据一致，也不需要为学习结果做迁移。
// 代价是每次分类多一遍扫描；千级数据量下可忽略，调用方按数组引用缓存即可。
// ============================================================

import type { ClassificationRule, Transaction } from '@/types';
import { buildMerchantMemory, type MerchantMemory } from './merchant-memory';
import { induceAmountTimeRules, type AmountTimeRule } from './amount-time-rules';
import { detectChannel } from './channels';
import type { ClassifyContext } from './classify';

export interface BuiltClassifyContext extends ClassifyContext {
  memory: MerchantMemory;
  amountTimeRules: AmountTimeRule[];
  channelStats: Map<string, Map<string, number>>;
}

function buildChannelStats(transactions: Transaction[]): Map<string, Map<string, number>> {
  const stats = new Map<string, Map<string, number>>();
  for (const txn of transactions) {
    if (txn.categorySource !== 'manual' || !txn.category) continue;
    const channel = detectChannel(`${txn.counterparty ?? ''} ${txn.description ?? ''}`);
    if (!channel) continue;
    const bucket = stats.get(channel.name) ?? new Map<string, number>();
    bucket.set(txn.category, (bucket.get(txn.category) ?? 0) + 1);
    stats.set(channel.name, bucket);
  }
  return stats;
}

export function buildClassifyContext(
  transactions: Transaction[],
  customRules: ClassificationRule[] = [],
): BuiltClassifyContext {
  return {
    customRules,
    memory: buildMerchantMemory(transactions),
    amountTimeRules: induceAmountTimeRules(transactions),
    channelStats: buildChannelStats(transactions),
  };
}
