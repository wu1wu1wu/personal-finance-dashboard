import { describe, expect, it } from 'vitest';
import { detectBrowserLocale, isLocale, normalizeLocale, LOCALES } from './locale';
import { createTranslator, interpolate, translateIn } from './translate';
import { MESSAGES } from './messages';
import type { MessageKey } from './messages';

describe('detectBrowserLocale', () => {
  it('中文（含地区变体）识别为简体中文', () => {
    expect(detectBrowserLocale('zh')).toBe('zh-CN');
    expect(detectBrowserLocale('zh-CN')).toBe('zh-CN');
    expect(detectBrowserLocale('zh-Hans-CN')).toBe('zh-CN');
    expect(detectBrowserLocale(['zh-TW', 'en-US'])).toBe('zh-CN');
  });

  it('英文识别为英文', () => {
    expect(detectBrowserLocale('en')).toBe('en');
    expect(detectBrowserLocale('en-GB')).toBe('en');
    expect(detectBrowserLocale(['en-US'])).toBe('en');
  });

  it('按顺序取第一个认识的语言，都不认识就回落中文', () => {
    expect(detectBrowserLocale(['fr-FR', 'en-US'])).toBe('en');
    expect(detectBrowserLocale(['fr-FR', 'de-DE'])).toBe('zh-CN');
    expect(detectBrowserLocale([])).toBe('zh-CN');
    expect(detectBrowserLocale(undefined)).toBe('zh-CN');
  });
});

describe('normalizeLocale', () => {
  it('合法值原样返回', () => {
    for (const locale of LOCALES) {
      expect(normalizeLocale(locale)).toBe(locale);
    }
  });

  it('非法值用兜底语言', () => {
    expect(normalizeLocale('fr', 'en')).toBe('en');
    expect(normalizeLocale(undefined, 'en')).toBe('en');
    expect(normalizeLocale(42, 'zh-CN')).toBe('zh-CN');
    expect(normalizeLocale(null, 'zh-CN')).toBe('zh-CN');
  });

  it('兜底值本身非法时回到默认语言', () => {
    expect(normalizeLocale('fr', 'de' as unknown as 'en')).toBe('zh-CN');
  });

  it('isLocale 只认白名单', () => {
    expect(isLocale('en')).toBe(true);
    expect(isLocale('en-US')).toBe(false);
    expect(isLocale(undefined)).toBe(false);
  });
});

describe('interpolate', () => {
  it('替换 {name} 占位符', () => {
    expect(interpolate('共 {count} 笔', { count: 3 })).toBe('共 3 笔');
  });

  it('没给参数时原样保留，不能显示成 undefined', () => {
    expect(interpolate('共 {count} 笔')).toBe('共 {count} 笔');
    expect(interpolate('{a} / {b}', { a: 1 })).toBe('1 / {b}');
  });
});

describe('translateIn', () => {
  it('按语言取文案', () => {
    expect(translateIn('zh-CN', 'nav.dashboard')).toBe('看板');
    expect(translateIn('en', 'nav.dashboard')).toBe('Dashboard');
  });

  it('带 count 时选单复数变体', () => {
    expect(translateIn('en', 'common.count', { count: 1 })).toBe('1 transaction');
    expect(translateIn('en', 'common.count', { count: 2 })).toBe('2 transactions');
    expect(translateIn('zh-CN', 'common.count', { count: 2 })).toBe('2 笔');
  });

  it('没有单复数变体时照常取原 key', () => {
    expect(translateIn('en', 'common.days', { count: 3 })).toBe('days');
  });

  it('该语言缺这条时回落到中文', () => {
    const dict = MESSAGES.en;
    const backup = dict['theme.title'];
    delete dict['theme.title'];
    try {
      expect(translateIn('en', 'theme.title')).toBe('外观');
    } finally {
      dict['theme.title'] = backup;
    }
    expect(translateIn('en', 'theme.title')).toBe('Appearance');
  });

  it('哪种语言都没有时返回 key 本身（界面上一眼看出漏了哪条）', () => {
    expect(translateIn('en', 'nope.missing' as MessageKey)).toBe('nope.missing');
  });

  it('createTranslator 绑定语言', () => {
    const { locale, t } = createTranslator('en');
    expect(locale).toBe('en');
    expect(t('nav.budget')).toBe('Budget');
  });
});
