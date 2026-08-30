// ============================================================
// 看板数据计算引擎 - 趋势/分类/日度/指标统计
// ============================================================

import type { Transaction } from '@/types';
import { CATEGORIES } from '@/types';
import { getMonthKey, getCurrentMonth, getRecentMonths, getDaysInMonth } from '@/utils/date';

/** 月度趋势数据点 */
export interface MonthlyTrendPoint {
  month: string;       // "2026-07"
  label: string;       // "7月"
  expense: number;     // 支出总额
  income: number;      // 收入总额
}

/** 分类占比数据点 */
export interface CategoryBreakdownPoint {
  category: string;
  amount: number;
  percentage: number;
  color: string;
  icon: string;
  count: number;       // 交易笔数
}

/** 日度支出数据点 */
export interface DailySpendPoint {
  day: string;         // "2026-07-05"
  label: string;       // "5日"
  amount: number;
}

/** 看板关键指标 */
export interface DashboardMetrics {
  totalExpense: number;
  totalIncome: number;
  dailyAverage: number;
  maxSingle: number;
  categoryCount: number;
  transactionCount: number;
}

/**
 * 计算月度支出趋势（近6个月）
 */
export function calcMonthlyTrend(transactions: Transaction[]): MonthlyTrendPoint[] {
  const months = getRecentMonths(6);

  return months.map((month) => {
    const monthTxns = transactions.filter((t) => getMonthKey(t.transactionTime) === month);
    const expense = monthTxns.filter((t) => t.amount > 0).reduce((s, t) => s + t.amount, 0);
    const income = monthTxns.filter((t) => t.amount < 0).reduce((s, t) => s + Math.abs(t.amount), 0);

    return {
      month,
      label: `${parseInt(month.substring(5))}月`,
      expense: Math.round(expense * 100) / 100,
      income: Math.round(income * 100) / 100,
    };
  });
}

/**
 * 计算当月分类支出占比
 */
export function calcCategoryBreakdown(
  transactions: Transaction[],
  month?: string,
): CategoryBreakdownPoint[] {
  const targetMonth = month ?? getCurrentMonth();
  const monthTxns = transactions.filter(
    (t) => getMonthKey(t.transactionTime) === targetMonth && t.amount > 0,
  );

  // 按分类汇总
  const categoryMap: Record<string, { amount: number; count: number }> = {};
  for (const txn of monthTxns) {
    const cat = txn.category || '待确认';
    if (!categoryMap[cat]) {
      categoryMap[cat] = { amount: 0, count: 0 };
    }
    categoryMap[cat].amount += txn.amount;
    categoryMap[cat].count += 1;
  }

  const total = Object.values(categoryMap).reduce((s, v) => s + v.amount, 0);

  // 转换为数据点，按金额降序
  return Object.entries(categoryMap)
    .map(([category, data]) => {
      const catInfo = CATEGORIES.find((c) => c.name === category) ?? CATEGORIES[CATEGORIES.length - 1];
      return {
        category,
        amount: Math.round(data.amount * 100) / 100,
        percentage: total > 0 ? Math.round((data.amount / total) * 1000) / 10 : 0,
        color: catInfo.color,
        icon: catInfo.icon,
        count: data.count,
      };
    })
    .sort((a, b) => b.amount - a.amount);
}

/**
 * 计算当月每日支出
 */
export function calcDailySpend(
  transactions: Transaction[],
  month?: string,
): DailySpendPoint[] {
  const targetMonth = month ?? getCurrentMonth();
  const days = getDaysInMonth(targetMonth);

  const monthTxns = transactions.filter(
    (t) => getMonthKey(t.transactionTime) === targetMonth && t.amount > 0,
  );

  // 按日汇总
  const dayMap: Record<string, number> = {};
  for (const txn of monthTxns) {
    const day = txn.transactionTime.substring(0, 10); // "2026-07-05"
    dayMap[day] = (dayMap[day] || 0) + txn.amount;
  }

  return days.map((day) => ({
    day,
    label: `${parseInt(day.substring(8))}日`,
    amount: Math.round((dayMap[day] || 0) * 100) / 100,
  }));
}

/**
 * 计算看板关键指标
 */
export function calcDashboardMetrics(
  transactions: Transaction[],
  month?: string,
): DashboardMetrics {
  const targetMonth = month ?? getCurrentMonth();
  const monthTxns = transactions.filter((t) => getMonthKey(t.transactionTime) === targetMonth);

  const expenseTxns = monthTxns.filter((t) => t.amount > 0);
  const totalExpense = expenseTxns.reduce((s, t) => s + t.amount, 0);
  const totalIncome = monthTxns
    .filter((t) => t.amount < 0)
    .reduce((s, t) => s + Math.abs(t.amount), 0);

  // 计算当月天数
  const [year, mon] = targetMonth.split('-').map(Number);
  const daysInMonth = new Date(year, mon, 0).getDate();
  const today = new Date();
  const isCurrentMonth = targetMonth === getCurrentMonth();
  // 如果是当前月，只算到今天；否则算整月
  const elapsedDays = isCurrentMonth
    ? Math.min(today.getDate(), daysInMonth)
    : daysInMonth;

  // 有支出的分类数
  const categories = new Set(expenseTxns.map((t) => t.category).filter(Boolean));

  // 最大单笔支出
  const maxSingle = expenseTxns.length > 0 ? Math.max(...expenseTxns.map((t) => t.amount)) : 0;

  return {
    totalExpense: Math.round(totalExpense * 100) / 100,
    totalIncome: Math.round(totalIncome * 100) / 100,
    dailyAverage: elapsedDays > 0 ? Math.round((totalExpense / elapsedDays) * 100) / 100 : 0,
    maxSingle: Math.round(maxSingle * 100) / 100,
    categoryCount: categories.size,
    transactionCount: monthTxns.length,
  };
}