// ============================================================
// 主题模式 - 纯逻辑部分
//
// 三种模式：跟随系统 / 强制浅色 / 强制深色。
// 真正的 DOM 操作与系统主题监听放在 apply-theme.ts，这里只做纯计算，便于单测。
// ============================================================

export type ThemeMode = 'system' | 'light' | 'dark';
export type ResolvedTheme = 'light' | 'dark';

export const DEFAULT_THEME_MODE: ThemeMode = 'system';

const THEME_MODES: ThemeMode[] = ['system', 'light', 'dark'];

/** 老数据/坏数据兜底：认不出就跟随系统 */
export function normalizeThemeMode(raw: unknown): ThemeMode {
  return typeof raw === 'string' && (THEME_MODES as string[]).includes(raw)
    ? (raw as ThemeMode)
    : DEFAULT_THEME_MODE;
}

/** 算出当前实际要用哪套配色 */
export function resolveTheme(mode: ThemeMode, systemPrefersDark: boolean): ResolvedTheme {
  if (mode === 'system') return systemPrefersDark ? 'dark' : 'light';
  return mode;
}
