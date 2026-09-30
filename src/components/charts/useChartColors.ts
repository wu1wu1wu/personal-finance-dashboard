// ============================================================
// useChartColors - 按当前外观返回图表调色板
//
// ECharts 读不到 CSS 变量，所以图表配色得由 JS 提供；
// 这个 hook 负责把「跟随系统」也考虑进来，并在系统主题切换时触发重绘。
// ============================================================

import { useEffect, useState } from 'react';
import { useSettingsStore } from '@/stores/settings-store';
import { systemPrefersDark, watchSystemTheme } from '@/theme/apply-theme';
import { resolveTheme } from '@/theme/theme';
import { CHART_COLORS, DARK_CHART_COLORS } from '@/constants/chart-colors';
import type { ChartPalette } from '@/constants/chart-colors';

export function useChartColors(): ChartPalette {
  const themeMode = useSettingsStore((s) => s.settings.themeMode);
  const [prefersDark, setPrefersDark] = useState(systemPrefersDark);

  useEffect(() => {
    if (themeMode !== 'system') return;
    setPrefersDark(systemPrefersDark());
    return watchSystemTheme(setPrefersDark);
  }, [themeMode]);

  return resolveTheme(themeMode, prefersDark) === 'dark' ? DARK_CHART_COLORS : CHART_COLORS;
}
