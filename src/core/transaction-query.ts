// ============================================================
// 交易查询引擎 - 筛选 / 排序 / 汇总（纯函数，便于单测）
// ============================================================

import type { Transaction } from '@/types';

/** 排序方式 */
export type SortKey = 'time-desc' | 'time-asc' | 'amount-desc' | 'amount-asc';

/** 收支方向筛选 */
export type DirectionFilter = 'all' | 'expense' | 'income';

export interface TransactionQuery {
  /** 分类（空 = 全部） */
  category?: string;
  /** 月份键 "2026-09"（空 = 全部） */
  month?: string;
  /** 收支方向 */
  direction?: DirectionFilter;
  /** 关键词（匹配交易对方 / 商品说明） */
  keyword?: string;
  /** 排序方式 */
  sort?: SortKey;
}

/** 交易列表汇总 */
export interface TransactionSummary {
  count: number;
  /** 支出合计（正数） */
  expense: number;
  /** 收入合计（正数） */
  income: number;
}

/** 金额约定：正数 = 支出，负数 = 收入 */
export function isExpense(txn: Transaction): boolean {
  return txn.amount > 0;
}

export function isIncome(txn: Transaction): boolean {
  return txn.amount < 0;
}

/**
 * 取出数据里实际出现过的月份键，倒序（最新在前）
 * 这样月份筛选不会列出没有交易的空白月份
 */
export function getAvailableMonths(transactions: Transaction[]): string[] {
  const months = new Set<string>();
  for (const t of transactions) {
    const key = t.transactionTime.substring(0, 7);
    if (/^\d{4}-\d{2}$/.test(key)) {
      months.add(key);
    }
  }
  return [...months].sort().reverse();
}

/**
 * 按条件筛选并排序。
 * 排序对金额使用绝对值，这样「金额从大到小」在支出和收入混排时符合直觉。
 */
export function queryTransactions(
  transactions: Transaction[],
  query: TransactionQuery = {},
): Transaction[] {
  const {
    category,
    month,
    direction = 'all',
    keyword,
    sort = 'time-desc',
  } = query;

  const kw = keyword?.trim().toLowerCase();

  const filtered = transactions.filter((t) => {
    if (category && t.category !== category) return false;
    if (month && !t.transactionTime.startsWith(month)) return false;
    if (direction === 'expense' && !isExpense(t)) return false;
    if (direction === 'income' && !isIncome(t)) return false;
    if (kw) {
      const haystack = `${t.counterparty} ${t.description}`.toLowerCase();
      if (!haystack.includes(kw)) return false;
    }
    return true;
  });

  const sorted = [...filtered];
  switch (sort) {
    case 'time-asc':
      sorted.sort((a, b) => a.transactionTime.localeCompare(b.transactionTime));
      break;
    case 'amount-desc':
      sorted.sort(
        (a, b) =>
          Math.abs(b.amount) - Math.abs(a.amount) ||
          b.transactionTime.localeCompare(a.transactionTime),
      );
      break;
    case 'amount-asc':
      sorted.sort(
        (a, b) =>
          Math.abs(a.amount) - Math.abs(b.amount) ||
          b.transactionTime.localeCompare(a.transactionTime),
      );
      break;
    case 'time-desc':
    default:
      sorted.sort((a, b) => b.transactionTime.localeCompare(a.transactionTime));
      break;
  }
  return sorted;
}

/** 汇总笔数、支出、收入 */
export function summarizeTransactions(transactions: Transaction[]): TransactionSummary {
  let expense = 0;
  let income = 0;
  for (const t of transactions) {
    if (t.amount > 0) expense += t.amount;
    else if (t.amount < 0) income += Math.abs(t.amount);
  }
  return {
    count: transactions.length,
    expense: Math.round(expense * 100) / 100,
    income: Math.round(income * 100) / 100,
  };
}
