import { describe, expect, it } from 'vitest';
import {
  formatDateForLocale,
  formatDateTimeForLocale,
  formatDayOfMonthForLocale,
  formatMonthForLocale,
  formatMonthShortForLocale,
  parseDateParts,
} from './date';

describe('parseDateParts', () => {
  it('解析 yyyy-MM-dd 与带时间的串', () => {
    expect(parseDateParts('2026-09-30')?.getDate()).toBe(30);
    expect(parseDateParts('2026-09-30 21:15:00')?.getMonth()).toBe(8);
  });

  it('解析不了的返回 null', () => {
    expect(parseDateParts('')).toBeNull();
    expect(parseDateParts('2026/09/30')).toBeNull();
    expect(parseDateParts('2026-13-01')).toBeNull();
    expect(parseDateParts('2026-09-32')).toBeNull();
  });
});

describe('formatDateForLocale', () => {
  it('中文是「9月30日」，英文是英文月份', () => {
    expect(formatDateForLocale('zh-CN', '2026-09-30')).toBe('9月30日');
    expect(formatDateForLocale('en', '2026-09-30')).toMatch(/Sep/);
    expect(formatDateForLocale('en', '2026-09-30')).toMatch(/30/);
  });

  it('解析不了就原样返回，不显示 Invalid Date', () => {
    expect(formatDateForLocale('en', '不是日期')).toBe('不是日期');
    expect(formatDateForLocale('zh-CN', '')).toBe('');
  });

  it('不是今年时带上年份（跨年列表里不会混淆）', () => {
    const past = formatDateForLocale('en', '2001-03-05');
    expect(past).toMatch(/2001/);
    expect(past).toMatch(/Mar/);
  });
});

describe('formatMonthForLocale', () => {  it('中文「2026年9月」，英文「September 2026」', () => {
    expect(formatMonthForLocale('zh-CN', '2026-09')).toBe('2026年9月');
    expect(formatMonthForLocale('en', '2026-09')).toBe('September 2026');
  });

  it('短标签只保留月份', () => {
    expect(formatMonthShortForLocale('zh-CN', '2026-09')).toBe('9月');
    expect(formatMonthShortForLocale('en', '2026-09')).toBe('Sep');
  });

  it('非法月份原样返回', () => {
    expect(formatMonthForLocale('en', '2026-13')).toBe('2026-13');
    expect(formatMonthForLocale('en', '')).toBe('');
  });
});

describe('formatDateTimeForLocale', () => {  it('带时间：中文「9月30日 21:15」，英文含 AM/PM', () => {
    expect(formatDateTimeForLocale('zh-CN', '2026-09-30 21:15:00')).toBe('9月30日 21:15');
    expect(formatDateTimeForLocale('en', '2026-09-30 21:15:00')).toMatch(/Sep 30/);
    expect(formatDateTimeForLocale('en', '2026-09-30 21:15:00')).toMatch(/9:15/);
  });

  it('没有时间部分时只显示日期', () => {
    expect(formatDateTimeForLocale('zh-CN', '2026-09-30')).toBe('9月30日');
  });

  it('解析不了就原样返回', () => {
    expect(formatDateTimeForLocale('en', '第 3 笔')).toBe('第 3 笔');
  });
});

describe('formatDayOfMonthForLocale', () => {
  it('中文「5日」、英文只有数字（柱状图 30 根轴标签不能太长）', () => {
    expect(formatDayOfMonthForLocale('zh-CN', '2026-09-05')).toBe('5日');
    expect(formatDayOfMonthForLocale('en', '2026-09-05')).toBe('5');
  });

  it('个位数日期不去前导零', () => {
    expect(formatDayOfMonthForLocale('zh-CN', '2026-01-09')).toBe('9日');
  });

  it('解析不了就原样返回', () => {
    expect(formatDayOfMonthForLocale('en', '')).toBe('');
  });
});
