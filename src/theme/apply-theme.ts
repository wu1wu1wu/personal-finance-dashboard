// ============================================================
// 主题应用 - 把解析出的配色写到 <html> 上
//
// 组件层不写任何 dark: 变体：所有的 bg-surface / text-ink 都指向令牌，
// 而令牌在 .dark 下被覆盖，所以只改这一个类名就能整体换肤。
// ============================================================

import { STORAGE_KEYS } from '@/types';
import { DEFAULT_THEME_MODE, normalizeThemeMode } from '@/theme/theme';
import type { ResolvedTheme, ThemeMode } from '@/theme/theme';

export const THEME_CLASS = 'dark';

/** 能被 applyThemeClass 操作的最小接口（测试里传假对象即可） */
export interface ThemeRoot {
  classList: {
    add: (name: string) => void;
    remove: (name: string) => void;
  };
}

/** 切换深浅色类名 */
export function applyThemeClass(theme: ResolvedTheme, root?: ThemeRoot): void {
  const target = root ?? (typeof document !== 'undefined' ? document.documentElement : undefined);
  if (!target) return;

  if (theme === 'dark') {
    target.classList.add(THEME_CLASS);
  } else {
    target.classList.remove(THEME_CLASS);
  }
}

/** 系统是否偏好深色 */
export function systemPrefersDark(): boolean {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return false;
  return window.matchMedia('(prefers-color-scheme: dark)').matches;
}

/**
 * 监听系统主题变化；返回取消监听的函数。
 * 只在「跟随系统」模式下需要用到。
 */
export function watchSystemTheme(onChange: (prefersDark: boolean) => void): () => void {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
    return () => {};
  }
  const query = window.matchMedia('(prefers-color-scheme: dark)');
  const handler = (event: MediaQueryListEvent) => onChange(event.matches);
  query.addEventListener('change', handler);
  return () => query.removeEventListener('change', handler);
}

/**
 * 同步读出已保存的主题模式。
 *
 * 首屏防闪需要它：原生端的 Preferences 是异步的，等 store 加载完再切类名
 * 会先闪一下白底，所以先尽力同步读一次（Web 端 localStorage 就是同步的）。
 */
export function readStoredThemeMode(): ThemeMode {
  try {
    const raw = globalThis.localStorage?.getItem(STORAGE_KEYS.SETTINGS);
    if (!raw) return DEFAULT_THEME_MODE;
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== 'object' || parsed === null) return DEFAULT_THEME_MODE;
    return normalizeThemeMode((parsed as { themeMode?: unknown }).themeMode);
  } catch {
    return DEFAULT_THEME_MODE;
  }
}
