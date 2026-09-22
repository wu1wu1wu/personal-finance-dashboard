// ============================================================
// 预算计算引擎 - 预算执行状态计算 + 预警判定
// ============================================================

import type { Transaction, Budget, BudgetStatus } from '@/types';
import { CATEGORIES } from '@/types';
import { getMonthKey } from '@/utils/date';
import { isConsumption } from '@/core/transaction-query';

/** 预警阈值 */
const WARNING_THRESHOLD = 0.8; // 80% 黄色预警
const EXCEEDED_THRESHOLD = 1.0; // 100% 红色超支

/**
 * 计算指定月份的分类预算执行状态
 * @param transactions 所有交易记录
 * @param budgets 分类预算设置（只取当月或通用的）
 * @param month 月份键 "2026-07"
 */
export function calcBudgetStatus(
  transactions: Transaction[],
  budgets: Budget[],
  month: string,
): BudgetStatus[] {
  // 筛选当月支出交易（amount > 0 表示支出）
  const monthTxns = transactions.filter(
    (t) => getMonthKey(t.transactionTime) === month && isConsumption(t),
  );

  // 按分类汇总支出
  const spentByCategory: Record<string, number> = {};
  for (const txn of monthTxns) {
    const cat = txn.category || '待确认';
    spentByCategory[cat] = (spentByCategory[cat] || 0) + txn.amount;
  }

  // 筛选当前月份适用的预算（精确匹配month，或旧数据month为空字符串）
  const applicableBudgets = budgets.filter(
    (b) => b.month === month || b.month === '',
  );

  // 为每个已设置预算的分类计算状态
  // 只设了「单笔上限」的记录 monthlyLimit 为 0，不参与月度进度条
  return applicableBudgets
    .filter((budget) => budget.monthlyLimit > 0)
    .map((budget) => {
      const spent = spentByCategory[budget.category] || 0;
      const percentage = spent / budget.monthlyLimit;
      const level = getWarningLevel(percentage);

      return {
        category: budget.category,
        spent,
        limit: budget.monthlyLimit,
        percentage,
        level,
      };
    });
}

/** 超出单笔上限的交易 */
export interface OverLimitTransaction {
  transaction: Transaction;
  /** 该分类的单笔上限 */
  limit: number;
  /** 超出金额 */
  over: number;
}

/**
 * 找出超过「单笔消费上限」的交易
 *
 * 上限按分类配置，优先取精确月份的设置，其次取空字符串（所有月份通用）。
 * 转账不计入消费，因此不参与判定。
 */
export function findOverLimitTransactions(
  transactions: Transaction[],
  budgets: Budget[],
  month?: string,
): OverLimitTransaction[] {
  // 分类 → 生效的单笔上限
  const limitByCategory = new Map<string, number>();
  for (const budget of budgets) {
    const limit = budget.maxPerTransaction ?? 0;
    if (limit <= 0) continue;
    const isExactMonth = month !== undefined && budget.month === month;
    const isGeneric = budget.month === '';
    if (isExactMonth) {
      limitByCategory.set(budget.category, limit);
    } else if (isGeneric && !limitByCategory.has(budget.category)) {
      limitByCategory.set(budget.category, limit);
    }
  }

  if (limitByCategory.size === 0) return [];

  const result: OverLimitTransaction[] = [];
  for (const txn of transactions) {
    if (!isConsumption(txn)) continue;
    if (month !== undefined && getMonthKey(txn.transactionTime) !== month) continue;
    const limit = limitByCategory.get(txn.category);
    if (limit === undefined) continue;
    if (txn.amount > limit) {
      result.push({ transaction: txn, limit, over: txn.amount - limit });
    }
  }

  return result.sort((a, b) =>
    b.transaction.transactionTime.localeCompare(a.transaction.transactionTime),
  );
}

/**
 * 计算总预算执行状态
 * @param transactions 所有交易记录
 * @param totalBudgets 按月份索引的总预算
 * @param month 月份键
 */
export function calcTotalBudgetStatus(
  transactions: Transaction[],
  totalBudgets: Record<string, number>,
  month: string,
): BudgetStatus | null {
  // 优先精确月份匹配，否则查空字符串（旧数据/通用预算）
  const totalBudget = totalBudgets[month] ?? totalBudgets[''] ?? 0;
  if (totalBudget <= 0) return null;

  const monthTxns = transactions.filter(
    (t) => getMonthKey(t.transactionTime) === month && isConsumption(t),
  );

  const totalSpent = monthTxns.reduce((sum, t) => sum + t.amount, 0);
  const percentage = totalSpent / totalBudget;

  return {
    category: '总预算',
    spent: totalSpent,
    limit: totalBudget,
    percentage,
    level: getWarningLevel(percentage),
  };
}

/**
 * 获取预警级别
 * @param percentage 执行率 0-1+
 */
export function getWarningLevel(
  percentage: number,
): 'normal' | 'warning' | 'exceeded' {
  if (percentage >= EXCEEDED_THRESHOLD) return 'exceeded';
  if (percentage >= WARNING_THRESHOLD) return 'warning';
  return 'normal';
}

/**
 * 获取预警级别对应的显示信息
 */
export function getWarningStyle(level: 'normal' | 'warning' | 'exceeded'): {
  color: string;
  bgColor: string;
  label: string;
} {
  switch (level) {
    case 'exceeded':
      return {
        color: '#DC2626',
        bgColor: '#FEE2E2',
        label: '已超支',
      };
    case 'warning':
      return {
        color: '#D97706',
        bgColor: '#FEF3C7',
        label: '接近预算',
      };
    case 'normal':
      return {
        color: '#059669',
        bgColor: '#D1FAE5',
        label: '正常',
      };
  }
}

/**
 * 获取分类信息（从CATEGORIES查找）
 */
export function getCategoryInfo(categoryName: string) {
  return CATEGORIES.find((c) => c.name === categoryName) ?? CATEGORIES[CATEGORIES.length - 1];
}
