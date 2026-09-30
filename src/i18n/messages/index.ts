import type { Locale } from '../locale';
import { en } from './en';
import { zhCN } from './zh-CN';
import type { MessageKey } from './zh-CN';

export type { MessageKey };

/** 语言 → 文案表 */
export const MESSAGES: Record<Locale, Record<string, string>> = {
  'zh-CN': zhCN,
  en,
};
