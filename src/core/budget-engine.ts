// ============================================================
// 预算计算引擎 - 预算执行状态计算 + 预警判定
// ============================================================

import type { Transaction, Budget, BudgetStatus } from '@/types';
import { CATEGORIES } from '@/types';
import { getMonthKey } from '@/utils/date';

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
    (t) => getMonthKey(t.transactionTime) === month && t.amount > 0,
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
  return applicableBudgets.map((budget) => {
    const spent = spentByCategory[budget.category] || 0;
    const percentage = budget.monthlyLimit > 0 ? spent / budget.monthlyLimit : 0;
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
    (t) => getMonthKey(t.transactionTime) === month && t.amount > 0,
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
  icon: string;
} {
  switch (level) {
    case 'exceeded':
      return {
        color: '#DC2626',
        bgColor: '#FEE2E2',
        label: '已超支',
        icon: '🔴',
      };
    case 'warning':
      return {
        color: '#D97706',
        bgColor: '#FEF3C7',
        label: '接近预算',
        icon: '🟡',
      };
    case 'normal':
      return {
        color: '#059669',
        bgColor: '#D1FAE5',
        label: '正常',
        icon: '🟢',
      };
  }
}

/**
 * 获取分类信息（从CATEGORIES查找）
 */
export function getCategoryInfo(categoryName: string) {
  return CATEGORIES.find((c) => c.name === categoryName) ?? CATEGORIES[CATEGORIES.length - 1];
}