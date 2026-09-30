// ============================================================
// 周期性交易识别引擎 - 自动检测+周期推断+下次预计
// ============================================================

import type { Transaction, PeriodicTransaction } from '@/types';
import { getMonthKey, getCurrentMonth, addMonthsClamped } from '@/utils/date';

/** 周期性交易分组键：counterparty + amount */
interface GroupKey {
  counterparty: string;
  amount: number;
}

/** 检测阈值：至少出现N个月才视为周期性 */
const MIN_MONTHS = 3;

/** 金额容差：允许±1元差异（如手续费微调） */
const AMOUNT_TOLERANCE = 1;

/**
 * 自动检测周期性交易
 * 算法：按 counterparty 分桶 → 桶内按 amount±1 分组 → 统计出现月数 → ≥3月则标记
 * 返回检测到的周期性交易列表
 *
 * 分桶是为了性能：原来每笔交易都要线性扫全部已有分组，
 * 交易上万条时是 O(n×分组数)，现在同商户内匹配即可（期望 O(n)）。
 */
export function detectPeriodicTransactions(
  transactions: Transaction[],
): PeriodicTransaction[] {
  // 1+2. 按 counterparty 分桶，桶内再按金额容差分组
  const byCounterparty = new Map<string, { key: GroupKey; txns: Transaction[] }[]>();

  for (const txn of transactions) {
    // 周期性通常为支出
    if (txn.amount <= 0) continue;

    const buckets = byCounterparty.get(txn.counterparty) ?? [];
    let bucket = buckets.find(
      (item) => Math.abs(item.key.amount - txn.amount) <= AMOUNT_TOLERANCE,
    );
    if (!bucket) {
      bucket = { key: { counterparty: txn.counterparty, amount: txn.amount }, txns: [] };
      buckets.push(bucket);
      byCounterparty.set(txn.counterparty, buckets);
    }
    bucket.txns.push(txn);
  }

  // 3. 筛选出现≥3个月的分组
  const results: PeriodicTransaction[] = [];

  for (const buckets of byCounterparty.values()) {
    for (const group of buckets) {
      const months = new Set(group.txns.map((t) => getMonthKey(t.transactionTime)));

      if (months.size < MIN_MONTHS) continue;

      // 4. 推断周期
      const period = inferPeriod(months);

      // 5. 计算置信度
      const confidence = calcConfidence(months.size, group.txns.length, period);

      // 6. 计算下次预计日期
      const lastDate = getLastDate(group.txns);
      const nextDate = predictNextDate(lastDate, period);

      // 取最常见的分类
      const category = getMostCommonCategory(group.txns);

      results.push({
        counterparty: group.key.counterparty,
        amount: group.key.amount,
        category,
        period,
        lastDate,
        nextDate,
        confidence,
      });
    }
  }

  // 按置信度降序排列
  return results.sort((a, b) => b.confidence - a.confidence);
}

/** 上一次计算的输入数组与结果：store 每次变更都会换新数组，据此判断是否需要重算 */
let periodicCacheKey: Transaction[] | null = null;
let periodicCacheValue: PeriodicTransaction[] = [];

/**
 * 带缓存的周期检测。
 * 看板渲染与 store 的自动标记会各自调用一次，同一份数据不必算两遍。
 */
export function getPeriodicTransactions(transactions: Transaction[]): PeriodicTransaction[] {
  if (periodicCacheKey !== transactions) {
    periodicCacheValue = detectPeriodicTransactions(transactions);
    periodicCacheKey = transactions;
  }
  return periodicCacheValue;
}

/**
 * 推断周期类型
 * 根据月份跨度判断：月度/季度/年度
 */
function inferPeriod(months: Set<string>): 'monthly' | 'quarterly' | 'yearly' {
  const sortedMonths = [...months].sort();

  if (sortedMonths.length < 2) return 'monthly';

  // 计算月份间隔
  const intervals: number[] = [];
  for (let i = 1; i < sortedMonths.length; i++) {
    const [y1, m1] = sortedMonths[i - 1].split('-').map(Number);
    const [y2, m2] = sortedMonths[i].split('-').map(Number);
    intervals.push((y2 - y1) * 12 + (m2 - m1));
  }

  const avgInterval = intervals.reduce((s, v) => s + v, 0) / intervals.length;

  if (avgInterval <= 1.5) return 'monthly';
  if (avgInterval <= 4) return 'quarterly';
  return 'yearly';
}

/**
 * 计算置信度
 * 月数越多、交易越规律 → 置信度越高
 */
function calcConfidence(
  monthCount: number,
  txnCount: number,
  period: 'monthly' | 'quarterly' | 'yearly',
): number {
  // 基础分：月数贡献（3月=0.5, 6月=0.8, 12月=1.0）
  const monthScore = Math.min(1, 0.3 + (monthCount - MIN_MONTHS) * 0.1);

  // 规律性分：每月1笔最规律
  const expectedPerMonth = period === 'monthly' ? 1 : period === 'quarterly' ? 0.33 : 0.08;
  const actualPerMonth = txnCount / monthCount;
  const regularityScore = 1 - Math.min(1, Math.abs(actualPerMonth - expectedPerMonth) / expectedPerMonth) * 0.3;

  return Math.round(monthScore * regularityScore * 100) / 100;
}

/**
 * 获取最近一次交易日期
 */
function getLastDate(txns: Transaction[]): string {
  const sorted = [...txns]
    .filter((t) => t.transactionTime) // 过滤空值
    .sort((a, b) => b.transactionTime.localeCompare(a.transactionTime));
  if (sorted.length === 0) return '';
  const dateStr = sorted[0].transactionTime.substring(0, 10);
  // 验证日期有效性
  const d = new Date(dateStr);
  return isNaN(d.getTime()) ? '' : dateStr;
}

/**
 * 预测下次交易日期
 */
function predictNextDate(
  lastDate: string,
  period: 'monthly' | 'quarterly' | 'yearly',
): string {
  if (!lastDate) return '';
  const months = period === 'monthly' ? 1 : period === 'quarterly' ? 3 : 12;
  return addMonthsClamped(lastDate, months);
}

/**
 * 获取分组中最常见的分类
 */
function getMostCommonCategory(txns: Transaction[]): string {
  const countMap: Record<string, number> = {};
  for (const txn of txns) {
    const cat = txn.category || '其他';
    countMap[cat] = (countMap[cat] || 0) + 1;
  }
  let maxCat = '其他';
  let maxCount = 0;
  for (const [cat, count] of Object.entries(countMap)) {
    if (count > maxCount) {
      maxCat = cat;
      maxCount = count;
    }
  }
  return maxCat;
}

// ----------------------------------------------------------
// 固定开销 vs 弹性开销 统计
// ----------------------------------------------------------

/** 固定/弹性开销统计 */
export interface PeriodicBreakdown {
  /** 固定开销总额 */
  fixedAmount: number;
  /** 弹性开销总额 */
  flexibleAmount: number;
  /** 固定开销笔数 */
  fixedCount: number;
  /** 弹性开销笔数 */
  flexibleCount: number;
  /** 固定开销分类明细 */
  fixedByCategory: Record<string, number>;
}

/**
 * 计算当月固定开销 vs 弹性开销
 */
export function calcPeriodicBreakdown(
  transactions: Transaction[],
  month?: string,
): PeriodicBreakdown {
  const targetMonth = month ?? getCurrentMonth();
  const monthTxns = transactions.filter(
    (t) => getMonthKey(t.transactionTime) === targetMonth && t.amount > 0,
  );

  const fixedTxns = monthTxns.filter((t) => t.isPeriodic);
  const flexibleTxns = monthTxns.filter((t) => !t.isPeriodic);

  const fixedAmount = fixedTxns.reduce((s, t) => s + t.amount, 0);
  const flexibleAmount = flexibleTxns.reduce((s, t) => s + t.amount, 0);

  const fixedByCategory: Record<string, number> = {};
  for (const txn of fixedTxns) {
    const cat = txn.category || '其他';
    fixedByCategory[cat] = (fixedByCategory[cat] || 0) + txn.amount;
  }

  return {
    fixedAmount: Math.round(fixedAmount * 100) / 100,
    flexibleAmount: Math.round(flexibleAmount * 100) / 100,
    fixedCount: fixedTxns.length,
    flexibleCount: flexibleTxns.length,
    fixedByCategory,
  };
}

/**
 * 批量标记周期性交易
 * 遍历交易列表，将检测到的周期性交易标记 isPeriodic=true
 * 返回需要新标记的交易 ID（已去重）
 *
 * 同样按 counterparty 建索引，避免"每条周期记录 × 全部交易"的双重循环。
 */
export function markPeriodicTransactions(
  transactions: Transaction[],
  periodicList: PeriodicTransaction[],
): string[] {
  if (periodicList.length === 0) return [];

  const candidatesByCounterparty = new Map<string, Transaction[]>();
  for (const txn of transactions) {
    if (txn.isPeriodic || txn.amount <= 0) continue;
    const list = candidatesByCounterparty.get(txn.counterparty);
    if (list) {
      list.push(txn);
    } else {
      candidatesByCounterparty.set(txn.counterparty, [txn]);
    }
  }

  const marked = new Set<string>();
  for (const periodic of periodicList) {
    for (const txn of candidatesByCounterparty.get(periodic.counterparty) ?? []) {
      if (Math.abs(txn.amount - periodic.amount) <= AMOUNT_TOLERANCE) {
        marked.add(txn.id);
      }
    }
  }

  return [...marked];
}