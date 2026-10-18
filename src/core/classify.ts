// src/core/classify.ts
// ============================================================
// 分类判定编排（六层，第一个命中即返回）
//
//   L1 你设的       → certain
//   L2 资金搬运/收入 → certain
//   L3 商户记忆      → certain（冲突则留白）
//   L4 品类关键词    → certain
//   L5 渠道         → 电商型 certain / 综合型 guessed
//   L6 时段+金额     → guessed（仅无商户记录）
//   兜底            → 待确认
//
// 设计文档：docs/plan-reclassify.md
// ============================================================

import type { ClassificationRule, Transaction } from '@/types';
import { classifyByKeyword } from './keyword-match';
import { extractMerchantKey } from './merchant-key';
import { lookupMerchantMemory, type MerchantMemory } from './merchant-memory';
import { detectChannel } from './channels';
import { matchAmountTimeRule, type AmountTimeRule } from './amount-time-rules';

export type ClassificationBasis =
  | 'user'
  | 'transfer'
  | 'income'
  | 'memory'
  | 'keyword'
  | 'ecommerce'
  | 'channel-guess'
  | 'amount-time'
  | 'rule'
  | 'none';

export type ClassificationLevel = 'certain' | 'guessed' | 'pending';

export interface ClassificationResult {
  category: string;
  basis: ClassificationBasis;
  level: ClassificationLevel;
  /** 人话依据，供界面展开 */
  reason: string;
  merchantKey: string | null;
}

export interface ClassifyContext {
  customRules?: ClassificationRule[];
  memory?: MerchantMemory;
  amountTimeRules?: AmountTimeRule[];
  /** 渠道 → (分类 → 条数)，由 buildChannelStats 生成 */
  channelStats?: Map<string, Map<string, number>>;
}

export const PENDING_CATEGORY = '待确认';
export const TRANSFER_CATEGORY = '转账';
export const INCOME_CATEGORY = '收入';

/** 渠道历史达到这个条数、且同一分类占比达到这个比例，才允许"推测" */
export const CHANNEL_MIN_SAMPLES = 3;
export const CHANNEL_MIN_RATIO = 0.8;

/** 资金搬运词 */
const TRANSFER_KEYWORDS = ['转账', '红包', '提现', '退款', '还款', '零钱通'];

function channelGuess(
  channel: string,
  stats: Map<string, Map<string, number>> | undefined,
): { category: string; support: number; ratio: number } | null {
  const bucket = stats?.get(channel);
  if (!bucket) return null;
  const total = [...bucket.values()].reduce((a, b) => a + b, 0);
  if (total < CHANNEL_MIN_SAMPLES) return null;
  const [category, count] = [...bucket.entries()].sort((a, b) => b[1] - a[1])[0];
  const ratio = count / total;
  if (ratio < CHANNEL_MIN_RATIO) return null;
  return { category, support: total, ratio };
}

/** 判定并返回完整依据 */
export function classifyTransactionDetailed(
  txn: Transaction,
  ctx: ClassifyContext = {},
): ClassificationResult {
  const text = `${txn.transactionType ?? ''} ${txn.counterparty ?? ''} ${txn.description ?? ''}`;
  const lower = text.toLowerCase();
  const merchantKey = extractMerchantKey(txn);

  // L1 你设的
  if (txn.categorySource === 'manual') {
    return {
      category: txn.category,
      basis: 'user',
      level: 'certain',
      reason: '你手动设置',
      merchantKey,
    };
  }

  // L2 资金搬运 / 收入
  const transferHit = TRANSFER_KEYWORDS.find((w) => lower.includes(w));
  if (transferHit) {
    return {
      category: TRANSFER_CATEGORY,
      basis: 'transfer',
      level: 'certain',
      reason: `含「${transferHit}」，属于资金搬运`,
      merchantKey,
    };
  }
  if (txn.amount < 0) {
    return { category: INCOME_CATEGORY, basis: 'income', level: 'certain', reason: '金额为负（收入）', merchantKey };
  }

  // L3 商户记忆
  const memory = lookupMerchantMemory(ctx.memory ?? new Map(), merchantKey);
  if (memory && 'category' in memory) {
    return {
      category: memory.category,
      basis: 'memory',
      level: 'certain',
      reason: `商户记忆：${merchantKey}`,
      merchantKey,
    };
  }
  if (memory && 'conflict' in memory) {
    return {
      category: PENDING_CATEGORY,
      basis: 'none',
      level: 'pending',
      reason: `商户「${merchantKey}」有不止一种历史分类`,
      merchantKey,
    };
  }

  // L4 品类关键词
  const keyword = classifyByKeyword(txn, { customRules: ctx.customRules });
  if (keyword) {
    return {
      category: keyword.category,
      basis: 'keyword',
      level: 'certain',
      reason: `命中关键词「${keyword.keyword}」`,
      merchantKey,
    };
  }

  // L5 渠道
  const channel = detectChannel(text);
  if (channel?.kind === 'ecommerce') {
    return {
      category: '购物消费',
      basis: 'ecommerce',
      level: 'certain',
      reason: `电商平台「${channel.name}」`,
      merchantKey,
    };
  }
  if (channel) {
    const guess = channelGuess(channel.name, ctx.channelStats);
    if (guess) {
      return {
        category: guess.category,
        basis: 'channel-guess',
        level: 'guessed',
        reason: `「${channel.name}」历史 ${guess.support} 条中 ${Math.round(guess.ratio * 100)}% 是${guess.category}`,
        merchantKey,
      };
    }
  }

  // L6 时段 + 金额（只对抽不出商户的记录）
  if (!merchantKey && ctx.amountTimeRules?.length) {
    const rule = matchAmountTimeRule(txn, ctx.amountTimeRules);
    if (rule) {
      return {
        category: rule.category,
        basis: 'amount-time',
        level: 'guessed',
        reason: `${rule.minAmount}~${rule.maxAmount} 元，历史 ${rule.support} 条中 ${Math.round(rule.hitRate * 100)}% 是${rule.category}`,
        merchantKey,
      };
    }
  }

  // 兜底
  return {
    category: PENDING_CATEGORY,
    basis: 'none',
    level: 'pending',
    reason: '没有任何可用依据',
    merchantKey,
  };
}

/** 只取分类名（兼容旧签名） */
export function classifyTransaction(txn: Transaction, ctx: ClassifyContext = {}): string {
  return classifyTransactionDetailed(txn, ctx).category;
}
