// ============================================================
// React 侧：拿翻译器、把语言同步到 <html lang>
// ============================================================

import { useEffect, useMemo } from 'react';
import { useSettingsStore } from '@/stores/settings-store';
import { LOCALE_TAGS } from './locale';
import type { Locale } from './locale';
import { createTranslator } from './translate';
import type { Translator } from './translate';

/** 当前语言 */
export function useLocale(): Locale {
  return useSettingsStore((s) => s.settings.locale);
}

/**
 * 当前语言的翻译器。
 * 语言变了才会重建，组件里可以放心放进 useMemo/useCallback 依赖。
 */
export function useT(): Translator {
  const locale = useLocale();
  return useMemo(() => createTranslator(locale), [locale]);
}

/** 把当前语言写到 <html lang>：读屏、浏览器翻译、断词都看这个属性 */
export function useLocaleEffect(): void {
  const locale = useLocale();
  useEffect(() => {
    document.documentElement.lang = LOCALE_TAGS[locale] ?? locale;
  }, [locale]);
}
