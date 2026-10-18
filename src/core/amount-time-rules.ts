// src/core/amount-time-rules.ts
// ============================================================
// 「时段 + 金额 → 分类」规则
//
// 背景：微信支付通知只有金额和时间，没有商户。实测（176 条真实数据）：
//   15~25 元 且 10:00–21:00 → 餐饮，支持 12 条、纯度 83%
// 金额是最强信号，时段主要用来排除清晨。83% ≠ 确定，所以只作为「推测」。
//
// 规则只从「用户确认过的分类」归纳，绝不从推测结果里学，否则会自我强化。
// ============================================================

import type { Transaction } from '@/types';

/** 归纳一条规则至少需要多少条样本 */
export const RULE_MIN_SUPPORT = 5;
/** 规则纯度（最高频分类占比）下限 */
export const RULE_MIN_PURITY = 0.8;
/** 最多保留几条规则（按支持数降序） */
export const RULE_MAX_COUNT = 8;

/** 金额档步长（元） */
const AMOUNT_STEP = 5;
/** 金额档上限（元） */
const AMOUNT_MAX = 120;

/** 候选时段窗口（分钟） */
const TIME_WINDOWS: { startMinute: number; endMinute: number }[] = [
  { startMinute: 0, endMinute: 24 * 60 - 1 },
  { startMinute: 6 * 60, endMinute: 10 * 60 },
  { startMinute: 10 * 60, endMinute: 14 * 60 },
  { startMinute: 14 * 60, endMinute: 18 * 60 },
  { startMinute: 18 * 60, endMinute: 22 * 60 },
  { startMinute: 10 * 60, endMinute: 21 * 60 },
];

export interface AmountTimeRule {
  category: string;
  /** 起始分钟数（0 表示不限） */
  startMinute: number;
  /** 结束分钟数 */
  endMinute: number;
  minAmount: number;
  maxAmount: number;
  /** 支持条数 */
  support: number;
  /** 纯度 0-1 */
  hitRate: number;
}

/** 从 "yyyy-MM-dd HH:mm:ss" 取当天分钟数；解析失败返回 null */
function minuteOfDay(dateTime: string): number | null {
  const m = dateTime?.match(/^\d{4}-\d{2}-\d{2}[ T](\d{2}):(\d{2})/);
  if (!m) return null;
  return Number(m[1]) * 60 + Number(m[2]);
}

/**
 * 从已确认（用户手设）的记录归纳规则。
 * 只使用 amount > 0 的支出记录；推测出来的分类不得参与。
 */
export function induceAmountTimeRules(confirmed: Transaction[]): AmountTimeRule[] {
  const samples = confirmed
    .filter((t) => t.categorySource === 'manual' && t.amount > 0 && t.category)
    .map((t) => ({ amount: t.amount, minute: minuteOfDay(t.transactionTime), category: t.category }))
    .filter((s): s is { amount: number; minute: number; category: string } => s.minute !== null);

  const candidates: AmountTimeRule[] = [];

  for (const window of TIME_WINDOWS) {
    for (let min = 0; min < AMOUNT_MAX; min += AMOUNT_STEP) {
      const max = min + AMOUNT_STEP;
      const inBucket = samples.filter(
        (s) => s.amount >= min && s.amount <= max && s.minute >= window.startMinute && s.minute <= window.endMinute,
      );
      if (inBucket.length < RULE_MIN_SUPPORT) continue;

      const counts = new Map<string, number>();
      for (const s of inBucket) counts.set(s.category, (counts.get(s.category) ?? 0) + 1);
      const top = [...counts.entries()].sort((a, b) => b[1] - a[1])[0];
      const hitRate = top[1] / inBucket.length;
      if (hitRate < RULE_MIN_PURITY) continue;

      candidates.push({
        category: top[0],
        startMinute: window.startMinute,
        endMinute: window.endMinute,
        minAmount: min,
        maxAmount: max,
        support: inBucket.length,
        hitRate,
      });
    }
  }

  // 同一分类只保留支持数最高的一条，避免规则互相打架
  const best = new Map<string, AmountTimeRule>();
  for (const c of candidates) {
    const current = best.get(c.category);
    if (!current || c.support > current.support || (c.support === current.support && c.hitRate > current.hitRate)) {
      best.set(c.category, c);
    }
  }

  return [...best.values()].sort((a, b) => b.support - a.support).slice(0, RULE_MAX_COUNT);
}

/** 匹配规则；不命中返回 null。收入（负数）不套用支出规则。 */
export function matchAmountTimeRule(
  txn: Pick<Transaction, 'amount' | 'transactionTime'>,
  rules: AmountTimeRule[],
): AmountTimeRule | null {
  if (txn.amount <= 0) return null;
  const minute = minuteOfDay(txn.transactionTime);
  if (minute === null) return null;
  const amount = Math.abs(txn.amount);
  return (
    rules.find(
      (r) => amount >= r.minAmount && amount <= r.maxAmount && minute >= r.startMinute && minute <= r.endMinute,
    ) ?? null
  );
}
