// ============================================================
// 语言 / 地区
//
// 界面语言是「设置」里的一项，和外观分开：外观只管配色，语言只管文案。
// 分类名、交易类型这类「数据里就有中文」的字段不做翻译，展示时按 key 映射。
// ============================================================

/** 支持的语言 */
export type Locale = 'zh-CN' | 'en';

export const LOCALES: readonly Locale[] = ['zh-CN', 'en'];

/** 兜底语言：任何缺失的文案都回落到它 */
export const DEFAULT_LOCALE: Locale = 'zh-CN';

/** 语言在界面上永远以它自己的语言显示（换成英文界面时「简体中文」不该变成 "Chinese"） */
export const LOCALE_LABELS: Record<Locale, string> = {
  'zh-CN': '简体中文',
  en: 'English',
};

/** `<html lang>` 用的标签 */
export const LOCALE_TAGS: Record<Locale, string> = {
  'zh-CN': 'zh-CN',
  en: 'en',
};

export function isLocale(value: unknown): value is Locale {
  return typeof value === 'string' && (LOCALES as readonly string[]).includes(value);
}

/**
 * 把存储里的值收敛成合法语言。
 * 没存过（首次打开）时用浏览器语言猜一个：中文浏览器得到中文，其他得到英文。
 */
export function normalizeLocale(
  raw: unknown,
  fallback: Locale = detectBrowserLocale(),
): Locale {
  if (isLocale(raw)) return raw;
  return isLocale(fallback) ? fallback : DEFAULT_LOCALE;
}

/**
 * 从 navigator.language / navigator.languages 推断语言。
 * 显式接收参数是为了能测（node 环境没有 navigator）。
 */
export function detectBrowserLocale(
  languages?: string | readonly string[] | undefined,
): Locale {
  const list =
    languages === undefined
      ? typeof navigator === 'undefined'
        ? []
        : navigator.languages?.length
          ? navigator.languages
          : [navigator.language]
      : typeof languages === 'string'
        ? [languages]
        : languages;

  for (const tag of list) {
    if (typeof tag !== 'string' || tag === '') continue;
    // zh、zh-CN、zh-Hans-CN、zh-TW 一律当简体中文（当前只有一套中文文案）
    if (tag.toLowerCase().startsWith('zh')) return 'zh-CN';
    if (tag.toLowerCase().startsWith('en')) return 'en';
  }

  return DEFAULT_LOCALE;
}
