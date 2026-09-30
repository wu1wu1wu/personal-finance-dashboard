import { describe, expect, it } from 'vitest';
import { CATEGORIES } from '@/types';
import { CATEGORY_MESSAGE_KEYS, categoryLabel, periodLabel, transactionTypeLabel } from './labels';
import { LOCALES } from './locale';
import { MESSAGES } from './messages';
import type { MessageKey } from './messages';

describe('分类 / 类型 / 周期 文案', () => {
  it('10 个分类都有文案映射（漏了就编译不过，这里再确认运行时不是 key）', () => {
    expect(Object.keys(CATEGORY_MESSAGE_KEYS)).toHaveLength(CATEGORIES.length);

    for (const { name } of CATEGORIES) {
      for (const locale of LOCALES) {
        const label = categoryLabel(locale, name);
        expect(label).not.toBe('');
        expect(label.startsWith('category.')).toBe(false);
      }
    }
  });

  it('中文分类名原样显示', () => {
    expect(categoryLabel('zh-CN', '餐饮美食')).toBe('餐饮美食');
    expect(categoryLabel('en', '餐饮美食')).toBe('Dining');
  });

  it('未知分类原样返回，不能显示成 key', () => {
    expect(categoryLabel('en', '自定义分类')).toBe('自定义分类');
    expect(categoryLabel('zh-CN', '')).toBe('');
  });

  it('收支方向与周期也走映射', () => {
    expect(transactionTypeLabel('en', '支出')).toBe('Spending');
    expect(transactionTypeLabel('zh-CN', '收入')).toBe('收入');
    expect(periodLabel('en', 'monthly')).toBe('Monthly');
    expect(periodLabel('zh-CN', 'yearly')).toBe('每年');
  });

  it('dataLabels 里所有中文值的 key 都真实存在', () => {
    for (const key of Object.values(CATEGORY_MESSAGE_KEYS)) {
      expect(MESSAGES['zh-CN'][key]).toBeDefined();
    }
  });
});

describe('分类文案的语言无关性', () => {
  it('翻译不影响数据里的分类名', () => {
    const before = CATEGORIES.map((c) => c.name);
    categoryLabel('en', '餐饮美食');
    expect(CATEGORIES.map((c) => c.name)).toEqual(before);
  });
});

describe('MessageKey 类型', () => {
  it('key 都在字典里（编译期约束的运行时复核）', () => {
    const keys = Object.keys(MESSAGES['zh-CN']) as MessageKey[];
    expect(keys.length).toBeGreaterThan(30);
    for (const key of keys) {
      expect(MESSAGES.en[key]).toBeTypeOf('string');
    }
  });
});
