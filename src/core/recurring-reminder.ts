// ============================================================
// 周期扣款提醒 - 在「周期性识别」之上判断该扣了 / 该扣没扣
// ============================================================
// 职责：把 periodic-engine 识别出的周期交易，换算成用户能直接消费的提醒：
//   - 预计下次扣款还有几天（upcoming / due / overdue）
//   - 最近一笔相比历史均价有没有涨价（降）
//   - 全部提醒折算成「每月固定支出」
//
// 纯函数、无语言：today 必须由调用方注入，模块内不读系统时间，
// 也不产出任何面向用户的文案，文案由调用层决定。
//
// 口径说明（几个容易含糊的地方，这里一次说清）：
//   - 「最近一笔」= 该商户 amount>0 且日期合法的记录里 transactionTime 最大的一笔
//   - amount 取最近一笔；previousAmount 取该商户更早的全部支出记录的算术平均
//     （不再按金额档位过滤：售后的调价、临时加价也算进「原价」才有意义）
//   - lastDate 就是最近一笔的日期，nextDate = lastDate + 一个周期
//
// ============================================================

import type { Transaction } from '@/types';
import { getPeriodicTransactions } from './periodic-engine';
import { addMonthsClamped } from '@/utils/date';

/** 提醒状态：该扣了 / 快扣了 / 该扣没扣 */
export type ReminderStatus = 'due' | 'upcoming' | 'overdue';

/** 单条周期扣款提醒 */
export interface RecurringReminder {
  /** 交易对方（商户名，同时是忽略列表的匹配键） */
  counterparty: string;
  /** 分类（沿用周期性识别里最常见的分类） */
  category: string;
  /** 预计扣款金额 = 最近一笔的金额 */
  amount: number;
  /** 之前几笔的平均金额（不含最近一笔），没有历史时为 0 */
  previousAmount: number;
  /** 涨价/降价判定：偏离历史均价超过阈值 */
  priceChanged: boolean;
  /** 周期 */
  period: 'monthly' | 'quarterly' | 'yearly';
  /** 最近一次扣款日期 'yyyy-MM-dd' */
  lastDate: string;
  /** 预计下次扣款日期 'yyyy-MM-dd' */
  nextDate: string;
  /** nextDate - today（负数 = 已过预计日期） */
  daysUntil: number;
  /** 状态 */
  status: ReminderStatus;
  /** 周期性识别的置信度 0-1 */
  confidence: number;
}

/** 提醒汇总 */
export interface RecurringSummary {
  /** status === 'due' 的条数 */
  dueCount: number;
  /** 上面这些条的金额合计 */
  dueTotal: number;
  /** status === 'overdue' 的条数 */
  overdueCount: number;
  /** 全部提醒折算成每月固定支出：monthly + quarterly/3 + yearly/12 */
  monthlyTotal: number;
  /** 提醒总条数 */
  reminderCount: number;
}

/** 构建提醒的入参 */
export interface RecurringReminderInput {
  transactions: Transaction[];
  /** 'yyyy-MM-dd'：必须注入，实现里不读系统时间 */
  today: string;
  /** 用户已忽略的商户名（counterparty），精确匹配 */
  ignored?: string[];
  /** 提前多少天算「即将扣款」，默认 7 */
  dueSoonDays?: number;
}

// ----------------------------------------------------------
// 常量与内部工具
// ----------------------------------------------------------

/** 默认提前提醒天数 */
const DEFAULT_DUE_SOON_DAYS = 7;

/** 价格变化的绝对下限（小额订阅用，避免 0.2 元的波动也算涨价） */
const PRICE_CHANGE_MIN_DIFF = 0.5;

/** 价格变化的相对阈值（5%） */
const PRICE_CHANGE_RATIO = 0.05;

/** 每个周期折算成月的除数 */
const MONTHS_PER_PERIOD: Record<'monthly' | 'quarterly' | 'yearly', number> = {
  monthly: 1,
  quarterly: 3,
  yearly: 12,
};

/** 一天的毫秒数 */
const MS_PER_DAY = 24 * 60 * 60 * 1000;

/** 'yyyy-MM-dd' 严格格式（月份/日期必须补零） */
const DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;

/** 商户的一笔支出记录 */
interface ExpenseRecord {
  amount: number;
  /** 原始交易时间 'yyyy-MM-dd HH:mm:ss'，字典序即时间序 */
  time: string;
}

/** 四舍五入到两位小数（金额统一口径） */
function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

/**
 * 解析日期为 UTC 毫秒时间戳，非法日期返回 null。
 *
 * 只取前 10 位，允许直接传 'yyyy-MM-dd HH:mm:ss'。
 * 用 UTC 而不是本地时间：本地时间在夏令时切换那天只有 23/25 小时，
 * 相减再取整会差一天；UTC 每天恒定 86400000 毫秒。
 * 回读校验是为了挡掉 '2026-02-30' 这种会被 Date 顺延的假日期。
 */
function parseDateUTC(dateStr: string): number | null {
  const matched = DATE_PATTERN.exec(dateStr.substring(0, 10));
  if (!matched) return null;

  const year = Number(matched[1]);
  const month = Number(matched[2]);
  const day = Number(matched[3]);
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;

  const ms = Date.UTC(year, month - 1, day);
  const date = new Date(ms);
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    return null;
  }
  return ms;
}

/**
 * 两个 'yyyy-MM-dd' 之间的天数差（to - from），UTC 计算避免时区误差。
 * 任一日期非法时返回 NaN（调用方自行决定如何处理）。
 */
export function daysBetween(from: string, to: string): number {
  const start = parseDateUTC(from);
  const end = parseDateUTC(to);
  if (start === null || end === null) return NaN;
  return Math.round((end - start) / MS_PER_DAY);
}

/** 提前提醒天数：缺省 7；非法值回落到 7，负数收敛到 0 */
function normalizeDueSoonDays(value?: number): number {
  if (value === undefined || !Number.isFinite(value)) return DEFAULT_DUE_SOON_DAYS;
  return Math.max(0, Math.floor(value));
}

/**
 * 状态判定（闭区间）：
 *   daysUntil < 0                 → overdue（预计日期已过却没扣，可能已取消或漏记）
 *   0 <= daysUntil <= dueSoonDays → due
 *   daysUntil > dueSoonDays       → upcoming
 */
function resolveStatus(daysUntil: number, dueSoonDays: number): ReminderStatus {
  if (daysUntil < 0) return 'overdue';
  if (daysUntil <= dueSoonDays) return 'due';
  return 'upcoming';
}

// ----------------------------------------------------------
// 主流程
// ----------------------------------------------------------

/**
 * 构建周期扣款提醒。
 *
 * 基础数据来自 getPeriodicTransactions()（同商户 + 金额容差、出现 ≥3 个月才算周期），
 * 金额与日期再从原始交易里按「该商户最近一笔」重算：周期识别的分组键带金额档位，
 * 一旦调价就会拆成两桶，直接沿用桶内金额会把涨价的订阅算成旧价钱。
 */
export function buildRecurringReminders(input: RecurringReminderInput): RecurringReminder[] {
  const { transactions, today } = input;
  const dueSoonDays = normalizeDueSoonDays(input.dueSoonDays);
  const ignored = new Set(input.ignored ?? []);

  const periodicList = getPeriodicTransactions(transactions);
  if (periodicList.length === 0) return [];

  // 按商户归集「日期合法」的支出记录：日期不合法的记录无法排序，直接不参与统计
  const expensesByCounterparty = new Map<string, ExpenseRecord[]>();
  for (const txn of transactions) {
    if (txn.amount <= 0) continue; // 只看支出（正数=支出）
    if (parseDateUTC(txn.transactionTime) === null) continue;
    const record: ExpenseRecord = { amount: txn.amount, time: txn.transactionTime };
    const list = expensesByCounterparty.get(txn.counterparty);
    if (list) list.push(record);
    else expensesByCounterparty.set(txn.counterparty, [record]);
  }

  const reminders: RecurringReminder[] = [];
  // 同商户同日期同金额的提醒只留一条：调价后引擎会把一个订阅拆成两个金额桶，
  // 两个桶重算出来的最近一笔是同一笔，不去重用户会看到两张一模一样的卡片
  const seen = new Set<string>();

  for (const periodic of periodicList) {
    if (ignored.has(periodic.counterparty)) continue;

    // 该商户的全部记录日期都不合法 → 猜不出下次扣款时间，跳过这条而不是抛异常
    const records = expensesByCounterparty.get(periodic.counterparty);
    if (!records || records.length === 0) continue;

    const latest = findLatestRecord(records);
    const lastDate = latest.time.substring(0, 10);
    const nextDate = addMonthsClamped(lastDate, MONTHS_PER_PERIOD[periodic.period]);
    // lastDate 归集时已校验；这里再兜一层（日期异常时 addMonthsClamped 会返回 ''）
    if (!nextDate || parseDateUTC(nextDate) === null) continue;

    const amount = round2(latest.amount);

    // 历史 = 严格早于最近一笔的记录（同一时间戳的算同一笔，不参与均价）
    const history = records.filter((record) => record.time < latest.time);
    const previousAmount =
      history.length > 0
        ? round2(history.reduce((sum, record) => sum + record.amount, 0) / history.length)
        : 0;

    const dedupeKey = `${periodic.counterparty}\u0000${amount}\u0000${lastDate}\u0000${nextDate}`;
    if (seen.has(dedupeKey)) continue;
    seen.add(dedupeKey);

    const daysUntil = daysBetween(today, nextDate);

    reminders.push({
      counterparty: periodic.counterparty,
      category: periodic.category,
      amount,
      previousAmount,
      priceChanged: isPriceChanged(amount, previousAmount),
      period: periodic.period,
      lastDate,
      nextDate,
      daysUntil,
      status: resolveStatus(daysUntil, dueSoonDays),
      confidence: periodic.confidence,
    });
  }

  // 最紧急的排前面；同一天的金额大的排前面
  return reminders.sort((a, b) => a.daysUntil - b.daysUntil || b.amount - a.amount);
}

/** 找出时间最晚的一笔（时间字符串是 'yyyy-MM-dd HH:mm:ss'，字典序即时间序） */
function findLatestRecord(records: ExpenseRecord[]): ExpenseRecord {
  let latest = records[0];
  for (const record of records) {
    if (record.time > latest.time) latest = record;
  }
  return latest;
}

/**
 * 是否算价格变化：没有历史（previousAmount = 0）时不判定，
 * 偏离超过 max(0.5 元, 历史均价的 5%) 才算（严格大于，正好卡在阈值上不算）。
 */
function isPriceChanged(amount: number, previousAmount: number): boolean {
  if (previousAmount <= 0) return false;
  const threshold = Math.max(PRICE_CHANGE_MIN_DIFF, previousAmount * PRICE_CHANGE_RATIO);
  return Math.abs(amount - previousAmount) > threshold;
}

// ----------------------------------------------------------
// 汇总
// ----------------------------------------------------------

/**
 * 汇总提醒：待扣条数与金额、逾期条数、每月固定支出。
 * 空列表时全部为 0。
 */
export function summarizeRecurringReminders(
  reminders: RecurringReminder[],
): RecurringSummary {
  let dueCount = 0;
  let dueTotal = 0;
  let overdueCount = 0;
  let monthlyTotal = 0;

  for (const reminder of reminders) {
    if (reminder.status === 'due') {
      dueCount += 1;
      dueTotal += reminder.amount;
    } else if (reminder.status === 'overdue') {
      overdueCount += 1;
    }
    monthlyTotal += reminder.amount / MONTHS_PER_PERIOD[reminder.period];
  }

  return {
    dueCount,
    dueTotal: round2(dueTotal),
    overdueCount,
    monthlyTotal: round2(monthlyTotal),
    reminderCount: reminders.length,
  };
}
