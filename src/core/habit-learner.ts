// ============================================================
// 习惯学习 - 从历史账单里学「金额分档 + 时段 → 分类」
//
// 用途：自动捕获的记录没有商户名，关键词规则命中不了就会落到「待确认」。
// 这里用历史账单（带真实商户、已被正确分类的记录）统计出习惯规律，
// 在置信度足够高时给出一个「推测」分类，让待确认的数量随时间下降。
//
// 原则：宁可返回 null（继续留在待确认），也不要给出低置信度的猜测。
// ============================================================

import type { Transaction } from '@/types';

/** 金额分档上限（元）：[0,5) [5,10) [10,20) [20,50) [50,100) [100,+∞) */
const AMOUNT_BUCKETS = [5, 10, 20, 50, 100];

/** 该分桶至少要有多少条历史样本才敢预测 */
export const MIN_SAMPLES = 5;

/** 最高频分类的最低占比 */
export const MIN_CONFIDENCE = 0.7;

export interface HabitPrediction {
  category: string;
  /** 该分类在分桶内的占比，0-1 */
  confidence: number;
}

export interface HabitModel {
  /** 预测分类；样本不足或置信度不够时返回 null */
  predict(txn: Transaction): HabitPrediction | null;
  /** 诊断用：训练样本数、分桶数 */
  stats: { samples: number; buckets: number };
}

/** 金额落在第几个分档 */
export function amountBucketIndex(amount: number): number {
  const abs = Math.abs(amount);
  for (let i = 0; i < AMOUNT_BUCKETS.length; i++) {
    if (abs < AMOUNT_BUCKETS[i]) return i;
  }
  return AMOUNT_BUCKETS.length;
}

/** 小时落在第几个时段分档：早晨 / 午间 / 下午 / 晚间 / 深夜 */
export function hourBucketIndex(hour: number): number {
  if (hour >= 6 && hour < 10) return 0;
  if (hour >= 10 && hour < 14) return 1;
  if (hour >= 14 && hour < 18) return 2;
  if (hour >= 18 && hour < 22) return 3;
  return 4;
}

/** 从 "yyyy-MM-dd HH:mm:ss" 取小时；解析失败返回 null */
function parseHour(dateTime: string): number | null {
  const m = dateTime?.match(/^\d{4}-\d{2}-\d{2}[ T](\d{2}):/);
  if (!m) return null;
  const hour = Number(m[1]);
  return Number.isNaN(hour) ? null : hour;
}

/**
 * 用历史记录训练模型。
 *
 * 只使用来源为「账单导入」（origin === 'import'）的记录：
 * 这些记录带真实商户且分类可信。占位记录和推测记录不参与，避免自我强化错误。
 */
export function buildHabitModel(history: Transaction[]): HabitModel {
  const buckets = new Map<string, Map<string, number>>();
  let samples = 0;

  for (const txn of history) {
    if (txn.origin !== 'import') continue;
    if (!txn.category || txn.category === '待确认') continue;
    const hour = parseHour(txn.transactionTime);
    if (hour === null) continue;

    const key = `${amountBucketIndex(txn.amount)}|${hourBucketIndex(hour)}`;
    const counts = buckets.get(key) ?? new Map<string, number>();
    counts.set(txn.category, (counts.get(txn.category) ?? 0) + 1);
    buckets.set(key, counts);
    samples++;
  }

  const predict = (txn: Transaction): HabitPrediction | null => {
    const hour = parseHour(txn.transactionTime);
    if (hour === null) return null;

    const counts = buckets.get(`${amountBucketIndex(txn.amount)}|${hourBucketIndex(hour)}`);
    if (!counts) return null;

    let total = 0;
    let topCategory = '';
    let topCount = 0;
    for (const [category, count] of counts) {
      total += count;
      if (count > topCount) {
        topCount = count;
        topCategory = category;
      }
    }

    if (total < MIN_SAMPLES) return null;
    const confidence = topCount / total;
    if (confidence < MIN_CONFIDENCE) return null;

    return { category: topCategory, confidence: Math.round(confidence * 100) / 100 };
  };

  return { predict, stats: { samples, buckets: buckets.size } };
}
