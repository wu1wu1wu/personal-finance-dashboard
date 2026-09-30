// ============================================================
// 文案翻译：查表 → 复数选择 → 占位符替换 → 回落
//
// 纯函数，不依赖 React，核心逻辑（core/）如果需要文案可以直接用 translateIn。
// ============================================================

import { DEFAULT_LOCALE } from './locale';
import type { Locale } from './locale';
import { MESSAGES } from './messages';
import type { MessageKey } from './messages';

/** 占位符参数：`t('x', { count: 3 })` 对应文案里的 `{count}` */
export type TranslateParams = Record<string, string | number>;

/**
 * 去掉复数后缀：`billImport.result.added_one` → `billImport.result.added`。
 * 这样 `t('billImport.result.added', { count })` 在类型上也是合法的，
 * 由 lookup() 在运行时按 count 选 _one / _other。
 */
type PluralBaseKey<T> = T extends `${infer Base}_one` | `${infer Base}_other` ? Base : never;

/** 可以传给 t() 的 key：字典里的 key，外加复数变体的基名 */
export type TranslationKey = MessageKey | PluralBaseKey<MessageKey>;

export type Translate = (key: TranslationKey, params?: TranslateParams) => string;

/** 一个语言绑定的翻译器，页面里用 useT() 拿到 */
export interface Translator {
  locale: Locale;
  t: Translate;
}

const PLACEHOLDER = /\{(\w+)\}/g;

/**
 * 替换 `{name}` 占位符。
 * 参数里没给的占位符原样保留：宁可界面上露出 `{name}`，也不要显示成 "undefined"。
 */
export function interpolate(template: string, params?: TranslateParams): string {
  if (!params) return template;
  return template.replace(PLACEHOLDER, (raw, name: string) => {
    const value = params[name];
    return value === undefined ? raw : String(value);
  });
}

/**
 * 取文案。带 count 时优先取 `_one` / `_other` 变体：
 * 英文需要区分单复数，中文两套可以写成一样的，也可以只写一条。
 */
function lookup(
  dict: Record<string, string> | undefined,
  key: string,
  count?: number,
): string | undefined {
  if (!dict) return undefined;
  if (typeof count === 'number') {
    const variant = count === 1 ? 'one' : 'other';
    return dict[`${key}_${variant}`] ?? dict[`${key}_other`] ?? dict[key];
  }
  return dict[key];
}

/**
 * 用指定语言翻译。
 * 该语言缺这条文案时回落到默认语言（中文），再缺就返回 key 本身——
 * 返回 key 而不是空串，界面上一眼能看出是哪条漏了。
 */
export function translateIn(
  locale: Locale,
  key: TranslationKey,
  params?: TranslateParams,
): string {
  const count = typeof params?.count === 'number' ? params.count : undefined;

  const message =
    lookup(MESSAGES[locale], key, count) ??
    lookup(MESSAGES[DEFAULT_LOCALE], key, count) ??
    key;

  return interpolate(message, params);
}

/** 绑定语言，得到 `t` */
export function createTranslator(locale: Locale): Translator {
  return {
    locale,
    t: (key, params) => translateIn(locale, key, params),
  };
}
