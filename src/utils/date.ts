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