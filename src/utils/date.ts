// ============================================================
// 日期工具函数
// ============================================================

/**
 * 获取当前月份键 "2026-07"
 */
export function getCurrentMonth(): string {
  const now = new Date();
  return `${now.getFullYear()}-${(now.getMonth() + 1).toString().padStart(2, '0')}`;
}

/**
 * 从日期时间字符串提取月份键
 * "2026-07-05 14:30:00" → "2026-07"
 */
export function getMonthKey(dateTimeStr: string): string {
  return dateTimeStr.substring(0, 7);
}

/**
 * 获取最近N个月的月份键列表
 * @param count 月数
 * @returns ["2026-05", "2026-06", "2026-07"]
 */
export function getRecentMonths(count: number): string[] {
  const months: string[] = [];
  const now = new Date();
  for (let i = count - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    months.push(
      `${d.getFullYear()}-${(d.getMonth() + 1).toString().padStart(2, '0')}`,
    );
  }
  return months;
}

/**
 * 今天的日期键 "2026-09-01"（本地时区）
 *
 * 不能用 toISOString().substring(0, 10)：那是 UTC 日期，
 * 东八区凌晨 0-8 点记账会掉到前一天，月初还会掉到上个月。
 */
export function getTodayLocal(now = new Date()): string {
  const y = now.getFullYear();
  const m = (now.getMonth() + 1).toString().padStart(2, '0');
  const d = now.getDate().toString().padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/** 月份键是否为合法的 "yyyy-MM" */
function isValidMonthKey(key: string): boolean {
  return /^\d{4}-(0[1-9]|1[0-2])$/.test(key);
}

/**
 * 组装月份选择器的选项：最近 6 个月 ∪ 有数据的月份 ∪ 有预算的月份 ∪ 下个月。
 *
 * - 下个月要留着：预算是可以提前给下个月设的
 * - 有数据/有预算的老月份也要留着：否则翻不回去看
 * - 统一倒序（最新在前），调用方直接渲染即可
 */
export function buildMonthOptions(
  monthsWithData: Iterable<string> = [],
  monthsWithBudget: Iterable<string> = [],
  now = new Date(),
): string[] {
  const months = new Set<string>();

  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    months.add(`${d.getFullYear()}-${(d.getMonth() + 1).toString().padStart(2, '0')}`);
  }
  const next = new Date(now.getFullYear(), now.getMonth() + 1, 1);
  months.add(`${next.getFullYear()}-${(next.getMonth() + 1).toString().padStart(2, '0')}`);

  for (const key of monthsWithData) if (isValidMonthKey(key)) months.add(key);
  for (const key of monthsWithBudget) if (isValidMonthKey(key)) months.add(key);

  return [...months].sort().reverse();
}

/**
 * 获取某月的所有日期键列表
 * @param monthKey "2026-07"
 * @returns ["2026-07-01", "2026-07-02", ..., "2026-07-31"]
 */
export function getDaysInMonth(monthKey: string): string[] {
  const [year, month] = monthKey.split('-').map(Number);
  const daysInMonth = new Date(year, month, 0).getDate();
  const days: string[] = [];
  for (let d = 1; d <= daysInMonth; d++) {
    days.push(`${monthKey}-${d.toString().padStart(2, '0')}`);
  }
  return days;
}

/**
 * 判断日期字符串是否属于指定月份
 */
export function isDateInMonth(dateStr: string, monthKey: string): boolean {
  return dateStr.startsWith(monthKey);
}

/**
 * 计算两个日期之间的天数差
 */
export function daysBetween(dateStr1: string, dateStr2: string): number {
  const d1 = new Date(dateStr1);
  const d2 = new Date(dateStr2);
  return Math.abs(Math.round((d2.getTime() - d1.getTime()) / (1000 * 60 * 60 * 24)));
}

/**
 * 格式化ISO日期为显示格式
 * "2026-07-05T14:30:00" → "2026-07-05 14:30:00"
 */
export function normalizeDateTime(raw: string): string {
  // 处理微信CSV中可能的日期格式
  const trimmed = raw.trim().replace(/\//g, '-');
  // 如果已经是标准格式，直接返回
  if (/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(trimmed)) {
    return trimmed;
  }
  // "2026-07-05T14:30:00" → "2026-07-05 14:30:00"
  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/.test(trimmed)) {
    return trimmed.replace('T', ' ').substring(0, 19);
  }
  // "2026/07/05 14:30:00" → "2026-07-05 14:30:00"
  return trimmed;
}

/**
 * 在日期字符串上安全地增加月份（月末溢出时收敛到目标月最后一天）
 * 纯字符串/数字运算，不依赖时区，避免 Date 的月末回卷问题
 * "2026-01-31" + 1 个月 → "2026-02-28"
 * "2024-02-29" + 12 个月 → "2025-02-28"
 */
export function addMonthsClamped(dateStr: string, months: number): string {
  const [y, m, d] = dateStr.substring(0, 10).split('-').map(Number);
  if (!y || !m || !d) return '';
  const totalMonths = y * 12 + (m - 1) + months;
  const targetYear = Math.floor(totalMonths / 12);
  const targetMonth = (totalMonths % 12) + 1;
  const daysInTarget = new Date(targetYear, targetMonth, 0).getDate();
  const day = Math.min(d, daysInTarget);
  return `${targetYear}-${targetMonth.toString().padStart(2, '0')}-${day.toString().padStart(2, '0')}`;
}

/**
 * 在月份键上前后移动（月度报告的上/下个月用）
 * "2026-01" - 1 → "2025-12"；"2026-12" + 1 → "2027-01"
 * 非法输入原样返回，交给调用方决定怎么兜底
 */
export function shiftMonthKey(monthKey: string, delta: number): string {
  const match = /^(\d{4})-(0[1-9]|1[0-2])$/.exec(monthKey ?? '');
  if (!match) return monthKey;

  const totalMonths = Number(match[1]) * 12 + (Number(match[2]) - 1) + delta;
  const year = Math.floor(totalMonths / 12);
  const month = (totalMonths % 12) + 1;
  return `${year}-${month.toString().padStart(2, '0')}`;
}