// ============================================================
// 日期/月份的本地化显示
//
// 明细里的 formatDateShort 是写死的中文格式（"7月5日 14:30"），
// 语言切到英文时就露馅了。这里用 Intl 按语言格式化，
// 并且手动拆分 'yyyy-MM-dd'，避开 iOS Safari 解析空格分隔日期串的老问题。
// ============================================================

import type { Locale } from './locale';

const DAY_FORMATTERS = new Map<string, Intl.DateTimeFormat>();
const MONTH_FORMATTERS = new Map<string, Intl.DateTimeFormat>();

function getFormatter(
  cache: Map<string, Intl.DateTimeFormat>,
  locale: Locale,
  options: Intl.DateTimeFormatOptions,
): Intl.DateTimeFormat {
  const cacheKey = `${locale}|${JSON.stringify(options)}`;
  let formatter = cache.get(cacheKey);
  if (!formatter) {
    formatter = new Intl.DateTimeFormat(locale, options);
    cache.set(cacheKey, formatter);
  }
  return formatter;
}

/** 'yyyy-MM-dd'（可带时间）→ Date；解析不了返回 null */
export function parseDateParts(value: string): Date | null {
  const match = value?.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  return new Date(year, month - 1, day);
}

/** 'yyyy-MM' → Date（当月 1 号）；解析不了返回 null */
export function parseMonthParts(month: string): Date | null {
  const match = month?.match(/^(\d{4})-(\d{2})$/);
  if (!match) return null;
  const year = Number(match[1]);
  const monthIndex = Number(match[2]);
  if (monthIndex < 1 || monthIndex > 12) return null;
  return new Date(year, monthIndex - 1, 1);
}

/** 日期：zh "9月30日" / en "Sep 30"；解析不了就原样返回 */
export function formatDateForLocale(locale: Locale, value: string): string {
  const date = parseDateParts(value);
  if (!date) return value;
  return getFormatter(DAY_FORMATTERS, locale, {
    month: 'short',
    day: 'numeric',
    ...(date.getFullYear() === new Date().getFullYear() ? {} : { year: 'numeric' }),
  }).format(date);
}

/** 月份：'2026-09' → zh "2026年9月" / en "September 2026" */
export function formatMonthForLocale(locale: Locale, month: string): string {
  const date = parseMonthParts(month);
  if (!date) return month;
  return getFormatter(MONTH_FORMATTERS, locale, { year: 'numeric', month: 'long' }).format(date);
}

/** 月份短标签：'2026-09' → zh "9月" / en "Sep" */
export function formatMonthShortForLocale(locale: Locale, month: string): string {
  const date = parseMonthParts(month);
  if (!date) return month;
  return getFormatter(MONTH_FORMATTERS, locale, { month: 'short' }).format(date);
}

/**
 * 只要「几号」：柱状图的 x 轴用。
 * 中文「5日」、英文「5」——英文再带月份会把 30 根轴标签挤成一团，
 * 而图表上方的卡片标题已经写明了是哪个月。
 */
export function formatDayOfMonthForLocale(locale: Locale, value: string): string {
  const date = parseDateParts(value);
  if (!date) return value;
  return locale === 'en' ? `${date.getDate()}` : `${date.getDate()}日`;
}

/** 日期 + 时间：'2026-09-30 21:15:00' → zh "9月30日 21:15" / en "Sep 30, 9:15 PM"。
 * 明细列表里的时间戳用它，替代写死中文的 formatDateShort。
 */
export function formatDateTimeForLocale(locale: Locale, value: string): string {
  const date = parseDateParts(value);
  if (!date) return value;

  const time = value.match(/[ T](\d{1,2}):(\d{2})/);
  const withTime = new Date(date);
  if (time) withTime.setHours(Number(time[1]), Number(time[2]), 0, 0);

  return getFormatter(DAY_FORMATTERS, locale, {
    month: 'short',
    day: 'numeric',
    ...(date.getFullYear() === new Date().getFullYear() ? {} : { year: 'numeric' }),
    ...(time ? { hour: 'numeric', minute: '2-digit' } : {}),
  }).format(withTime);
}
