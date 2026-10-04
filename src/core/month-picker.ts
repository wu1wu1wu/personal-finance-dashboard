// ============================================================
// 年月选择器的纯逻辑
//
// 原来的月份选择器是一个横滑的 chip 行，只写「9月」、不带年份，
// 而且选项来自「最近 6 个月 ∪ 有数据 ∪ 有预算 ∪ 下个月」——
// 月份一多就变成一条越来越长的横条，也看不出是哪一年。
//
// 现在改成「翻年份 + 12 个月网格」：这里负责年份边界、月份键的拼装与解析，
// 页面只负责排版。全部是纯函数，便于单测。
// ============================================================

export interface MonthParts {
  year: number;
  /** 1-12 */
  month: number;
}

const MONTH_KEY = /^(\d{4})-(0[1-9]|1[0-2])$/;

/** "2026-09" → { year: 2026, month: 9 }；非法返回 null */
export function parseMonthKey(key: string): MonthParts | null {
  const match = MONTH_KEY.exec(key ?? '');
  if (!match) return null;
  return { year: Number(match[1]), month: Number(match[2]) };
}

/** { 2026, 9 } → "2026-09"；越界或年份非法返回空串（不猜） */
export function toMonthKey(year: number, month: number): string {
  if (!Number.isInteger(year) || year < 1000 || year > 9999) return '';
  if (!Number.isInteger(month) || month < 1 || month > 12) return '';
  return `${year}-${month.toString().padStart(2, '0')}`;
}

/** 某一年的 12 个月份键，按 1→12 顺序 */
export function buildYearMonths(year: number): string[] {
  return Array.from({ length: 12 }, (_, index) => `${year}-${(index + 1).toString().padStart(2, '0')}`);
}

/** 在年份上前后翻，月份不变："2026-09" -1 → "2025-09"；非法输入原样返回 */
export function shiftYear(monthKey: string, delta: number): string {
  const parts = parseMonthKey(monthKey);
  if (!parts) return monthKey;
  return toMonthKey(parts.year + delta, parts.month) || monthKey;
}

/** 这一年里哪些月份有数据（网格上打点用） */
export function monthsWithDataInYear(months: Iterable<string>, year: number): Set<number> {
  const result = new Set<number>();
  for (const key of months) {
    const parts = parseMonthKey(key);
    if (parts && parts.year === year) result.add(parts.month);
  }
  return result;
}

/**
 * 可选的年份区间：数据（含预算）所在年 ∪ 锚点年 ∪ 今年 ∪ 下个月所在年。
 * 往前能一直翻到最早一条记录那年，往后能提前给下个月（12 月时是明年）做预算，
 * 再往外就没有意义了——避免用户在网格里无限翻到 1970。
 */
export function yearBounds(
  anchor: string,
  monthsWithData: Iterable<string>,
  now = new Date(),
): { min: number; max: number } {
  const years = new Set<number>();

  const anchorParts = parseMonthKey(anchor);
  if (anchorParts) years.add(anchorParts.year);

  years.add(now.getFullYear());
  // 下个月所在年：12 月的下个月就是明年
  years.add(new Date(now.getFullYear(), now.getMonth() + 1, 1).getFullYear());

  for (const key of monthsWithData) {
    const parts = parseMonthKey(key);
    if (parts) years.add(parts.year);
  }

  return { min: Math.min(...years), max: Math.max(...years) };
}
