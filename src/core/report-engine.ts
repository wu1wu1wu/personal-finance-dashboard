// ============================================================
// 报表引擎 - 月度报表汇总（收支 / 环比 / 分类 TOP / 日度 / 周期交易 / 预算）
// ============================================================

import type { Transaction } from '@/types';
import { getMonthKey, getTodayLocal, getDaysInMonth } from '@/utils/date';
import { isConsumption } from '@/core/transaction-query';
import { calcCategoryBreakdown } from '@/core/dashboard-engine';
import { calcTotalBudgetStatus } from '@/core/budget-engine';

/** 分类支出报表行 */
export interface CategoryReportRow {
  category: string;
  amount: number;
  count: number;
  percentage: number;
}

/** 某一项收支对比（上个月的同项） */
export interface MonthComparison {
  income: number;
  expense: number;
  net: number;
}

/** 环比变化（百分数，保留一位）；上期为 0 时为 null */
export interface ReportDelta {
  income: number | null;
  expense: number | null;
  net: number | null;
}

/** 最大单笔支出 */
export interface LargestExpense {
  id: string;
  counterparty: string;
  description: string;
  amount: number;
  date: string;
}

/** 周期性交易报表行（当月实际发生的） */
export interface PeriodReportRow {
  counterparty: string;
  amount: number;
  period: 'monthly' | 'quarterly' | 'yearly';
  lastDate: string;
}

/** 月度报表 */
export interface MonthlyReport {
  month: string;                 // 'yyyy-MM'
  hasData: boolean;              // 该月是否有任何交易
  income: number;                // 正数
  expense: number;               // 正数，只算 isConsumption
  net: number;                   // income - expense
  transactionCount: number;      // 该月全部记录数
  consumptionCount: number;      // 计入支出的笔数
  pendingCount: number;          // 分类为空的记录数（待确认）
  elapsedDays: number;           // 已过去的统计天数
  dailyAverage: number;          // expense / elapsedDays，保留两位
  largestExpense: LargestExpense | null;
  topCategories: CategoryReportRow[];   // 按金额降序，最多 5 条
  previous: MonthComparison;     // 上个月的同项
  deltas: ReportDelta;           // 环比百分比（保留一位）；上月该项为 0 → null
  daily: { day: string; expense: number; income: number }[];  // 该月每一天（'yyyy-MM-dd'）
  periodics: PeriodReportRow[];  // 该月实际发生的周期性交易（txn.isPeriodic），按金额降序
  budget: {
    limit: number;
    spent: number;
    percentage: number;
    level: 'normal' | 'warning' | 'exceeded';
  } | null;
}

export interface MonthlyReportInput {
  transactions: Transaction[];
  month: string;                          // 'yyyy-MM'
  totalBudgets?: Record<string, number>;  // 传给 calcTotalBudgetStatus；不传则 budget 为 null
  today?: string;                         // 'yyyy-MM-dd'，默认今天；测试注入用
}

/** 合法的月份键 */
const MONTH_KEY_PATTERN = /^\d{4}-(0[1-9]|1[0-2])$/;

/** 保留两位小数（与仓库其他引擎保持同一写法） */
function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

/** 保留一位小数（环比百分比用） */
function round1(value: number): number {
  return Math.round(value * 10) / 10;
}

/**
 * 上一个月份键
 * '2026-01' → '2025-12'
 * 非法输入返回空串，调用方拿不到数据自然退化为 0
 */
export function previousMonth(month: string): string {
  const [year, mon] = month.split('-').map(Number);
  if (!Number.isInteger(year) || !Number.isInteger(mon) || mon < 1 || mon > 12) return '';

  const totalMonths = year * 12 + (mon - 1) - 1;
  const prevYear = Math.floor(totalMonths / 12);
  const prevMon = (totalMonths % 12) + 1;
  // 年份补足 4 位：'0001-01' 这类极端输入也要返回合法的月份键
  return `${prevYear.toString().padStart(4, '0')}-${prevMon.toString().padStart(2, '0')}`;
}

/**
 * 某月已经过去的天数。
 *
 * - 今天所在月 → 今天的日号
 * - 早于今天所在月 → 该月天数
 * - 晚于今天所在月（未来月）→ 0，此时日均支出按 0 处理
 *
 * 时间基准一律由 today 注入（默认今天），避免同一份数据在不同时刻算出不同结果。
 * 「早/晚」用 'yyyy-MM' 字符串比较即可，格式固定不会出错。
 */
export function elapsedDaysInMonth(month: string, today: string): number {
  if (!MONTH_KEY_PATTERN.test(month)) return 0;

  const todayMonth = today.substring(0, 7);
  if (month === todayMonth) {
    const day = Number(today.substring(8, 10));
    return Number.isInteger(day) && day > 0 ? day : 0;
  }
  if (month < todayMonth) return getDaysInMonth(month).length;
  return 0;
}

/** 某月收入合计（负数取绝对值） */
function sumIncome(monthTxns: Transaction[]): number {
  const total = monthTxns
    .filter((t) => t.amount < 0)
    .reduce((sum, t) => sum + Math.abs(t.amount), 0);
  return round2(total);
}

/** 某月消费支出合计（转账/不计收支不算） */
function sumExpense(monthTxns: Transaction[]): number {
  const total = monthTxns.filter(isConsumption).reduce((sum, t) => sum + t.amount, 0);
  return round2(total);
}

/** 某月收支对比 */
function buildComparison(transactions: Transaction[], month: string): MonthComparison {
  const monthTxns = transactions.filter((t) => getMonthKey(t.transactionTime) === month);
  const income = sumIncome(monthTxns);
  const expense = sumExpense(monthTxns);
  return { income, expense, net: round2(income - expense) };
}

/**
 * 环比百分比：(本月 - 上月) / |上月| * 100，保留一位。
 * 上月为 0 时没有「变化率」可言，返回 null（本月也为 0 同样落到这里）。
 */
function calcDelta(current: number, previous: number): number | null {
  if (previous === 0) return null;
  return round1(((current - previous) / Math.abs(previous)) * 100);
}

/** 按日汇总收支，缺失的日子补 0 */
function buildDaily(
  monthTxns: Transaction[],
  month: string,
): { day: string; expense: number; income: number }[] {
  const expenseByDay: Record<string, number> = {};
  const incomeByDay: Record<string, number> = {};

  for (const txn of monthTxns) {
    const day = txn.transactionTime.substring(0, 10);
    if (isConsumption(txn)) {
      expenseByDay[day] = (expenseByDay[day] || 0) + txn.amount;
    }
    if (txn.amount < 0) {
      incomeByDay[day] = (incomeByDay[day] || 0) + Math.abs(txn.amount);
    }
  }

  return getDaysInMonth(month).map((day) => ({
    day,
    expense: round2(expenseByDay[day] || 0),
    income: round2(incomeByDay[day] || 0),
  }));
}

/**
 * 推断周期类型（月度/季度/年度）。
 *
 * periodic-engine 的 inferPeriod 没有导出，而本次只允许新建文件，所以这里按同一套
 * 阈值（平均间隔 ≤1.5 月 = 月度，≤4 月 = 季度，否则年度）重新实现一份。
 * 推断依据是该商户所有「已标记 isPeriodic」记录出现过的月份，而不是引擎检测时的
 * 金额分组：当月只要出现一笔就说明这个周期还在延续，跨金额波动也能识别。
 */
function inferPeriod(months: Iterable<string>): 'monthly' | 'quarterly' | 'yearly' {
  const sorted = [...new Set(months)].sort();
  if (sorted.length < 2) return 'monthly';

  let totalInterval = 0;
  for (let i = 1; i < sorted.length; i++) {
    const [y1, m1] = sorted[i - 1].split('-').map(Number);
    const [y2, m2] = sorted[i].split('-').map(Number);
    totalInterval += (y2 - y1) * 12 + (m2 - m1);
  }

  const avgInterval = totalInterval / (sorted.length - 1);
  if (avgInterval <= 1.5) return 'monthly';
  if (avgInterval <= 4) return 'quarterly';
  return 'yearly';
}

/**
 * 当月实际发生的周期性交易。
 *
 * 同一商户去重取金额最大的一笔（金额会因手续费等微调），lastDate 取该商户当月
 * 周期性记录里最晚的日期；周期类型按该商户历史月份间隔推断。
 */
function buildPeriodics(
  allTxns: Transaction[],
  monthTxns: Transaction[],
): PeriodReportRow[] {
  // 当月各商户的周期性记录
  const byCounterparty = new Map<string, Transaction[]>();
  for (const txn of monthTxns) {
    if (!txn.isPeriodic) continue;
    const list = byCounterparty.get(txn.counterparty);
    if (list) list.push(txn);
    else byCounterparty.set(txn.counterparty, [txn]);
  }
  if (byCounterparty.size === 0) return [];

  // 全量历史里各商户周期性记录出现过的月份（用于推断周期）
  const historyMonths = new Map<string, Set<string>>();
  for (const txn of allTxns) {
    if (!txn.isPeriodic || !txn.transactionTime) continue;
    const months = historyMonths.get(txn.counterparty) ?? new Set<string>();
    months.add(getMonthKey(txn.transactionTime));
    historyMonths.set(txn.counterparty, months);
  }

  const rows: PeriodReportRow[] = [];
  for (const [counterparty, txns] of byCounterparty) {
    let top = txns[0];
    let lastTime = txns[0].transactionTime;
    for (const txn of txns) {
      if (txn.amount > top.amount) top = txn;
      if (txn.transactionTime.localeCompare(lastTime) > 0) lastTime = txn.transactionTime;
    }

    rows.push({
      counterparty,
      amount: round2(top.amount),
      period: inferPeriod(historyMonths.get(counterparty) ?? []),
      lastDate: lastTime.substring(0, 10),
    });
  }

  // 金额降序；金额并列时按商户名排序，保证结果与输入顺序无关
  return rows.sort((a, b) => b.amount - a.amount || a.counterparty.localeCompare(b.counterparty));
}

/** 总预算执行状态 → 报表字段（percentage 沿用 calcTotalBudgetStatus 的比例口径 0-1+） */
function buildBudget(
  transactions: Transaction[],
  totalBudgets: Record<string, number> | undefined,
  month: string,
): MonthlyReport['budget'] {
  if (!totalBudgets) return null;

  const status = calcTotalBudgetStatus(transactions, totalBudgets, month);
  if (!status) return null;

  return {
    limit: status.limit,
    spent: round2(status.spent),
    percentage: status.percentage,
    level: status.level,
  };
}

/**
 * 构建月度报表。
 *
 * 口径说明：
 * - expense 只算 isConsumption（转账、「不计收支」不算），income 是负数金额的绝对值（不做转账区分）
 * - 所有金额保留两位小数
 * - 月份非法（如 '2026-13'）时安全退化：hasData=false、日度为空数组，不抛异常
 */
export function buildMonthlyReport(input: MonthlyReportInput): MonthlyReport {
  const { transactions, month, totalBudgets, today = getTodayLocal() } = input;
  const isValidMonth = MONTH_KEY_PATTERN.test(month);

  const monthTxns = transactions.filter((t) => getMonthKey(t.transactionTime) === month);
  const consumptionTxns = monthTxns.filter(isConsumption);

  const income = sumIncome(monthTxns);
  const expense = sumExpense(monthTxns);
  const net = round2(income - expense);

  const previous = buildComparison(transactions, previousMonth(month));

  const elapsedDays = elapsedDaysInMonth(month, today);

  // 最大单笔支出：并列时取时间最晚的一笔
  let largest: Transaction | null = null;
  for (const txn of consumptionTxns) {
    if (!largest) {
      largest = txn;
      continue;
    }
    if (txn.amount > largest.amount) largest = txn;
    else if (txn.amount === largest.amount && txn.transactionTime.localeCompare(largest.transactionTime) > 0) {
      largest = txn;
    }
  }

  const topCategories: CategoryReportRow[] = calcCategoryBreakdown(transactions, month)
    .slice(0, 5)
    .map((row) => ({
      category: row.category,
      amount: row.amount,
      count: row.count,
      percentage: row.percentage,
    }));

  return {
    month,
    hasData: monthTxns.length > 0,
    income,
    expense,
    net,
    transactionCount: monthTxns.length,
    consumptionCount: consumptionTxns.length,
    pendingCount: monthTxns.filter((t) => !t.category).length,
    elapsedDays,
    dailyAverage: elapsedDays > 0 ? round2(expense / elapsedDays) : 0,
    largestExpense: largest
      ? {
          id: largest.id,
          counterparty: largest.counterparty,
          description: largest.description,
          amount: round2(largest.amount),
          date: largest.transactionTime.substring(0, 10),
        }
      : null,
    topCategories,
    previous,
    deltas: {
      income: calcDelta(income, previous.income),
      expense: calcDelta(expense, previous.expense),
      net: calcDelta(net, previous.net),
    },
    daily: isValidMonth ? buildDaily(monthTxns, month) : [],
    periodics: isValidMonth ? buildPeriodics(transactions, monthTxns) : [],
    budget: buildBudget(transactions, totalBudgets, month),
  };
}
