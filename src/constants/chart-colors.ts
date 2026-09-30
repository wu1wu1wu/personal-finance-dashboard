// ============================================================
// 图表配色 - 与 src/index.css 里的令牌保持一致的单一来源
//
// 为什么单独放一份 TS 常量：ECharts 的 option 只接受字符串色值，
// 读不到 CSS 变量（且 SSR 渲染时没有 DOM）。所以这里与 CSS 令牌成对维护，
// 并由 chart-colors.test.ts 的断言守住：浅深两套都必须与令牌同值、且满足对比度。
//
// 改动时同步 src/index.css 的 @theme 与 .dark。
// ============================================================

export interface ChartPalette {
  /** 支出（--color-expense） */
  expense: string;
  /** 收入（--color-income） */
  income: string;
  /** 预警 / 参考线（--color-alert） */
  alert: string;
  /** 主色（--color-brand） */
  brand: string;
  /** 柱状图主色 */
  bar: string;
  /** 固定开销 */
  fixed: string;
  /** 弹性开销 */
  flexible: string;
  /** 坐标轴标签文字（--color-ink-subtle） */
  axisLabel: string;
  /** 图例文字（--color-ink-muted） */
  legendText: string;
  /** 网格虚线：装饰用，不受文本对比度约束 */
  gridLine: string;
  axisLine: string;
  /** 环形图分块描边：与卡片底色一致 */
  surface: string;
}

/** 浅色主题（对应 index.css 的 @theme） */
export const CHART_COLORS: ChartPalette = {
  expense: '#c92a2e',
  income: '#0b7a44',
  alert: '#b45309',
  brand: '#2563eb',
  bar: '#4f46e5',
  fixed: '#4f46e5',
  flexible: '#b45309',
  axisLabel: '#6b7280',
  legendText: '#5b6675',
  gridLine: '#f1f3f7',
  axisLine: '#e8ebf0',
  surface: '#ffffff',
};

/** 深色主题（对应 index.css 的 .dark） */
export const DARK_CHART_COLORS: ChartPalette = {
  expense: '#f87171',
  income: '#34d399',
  alert: '#fbbf24',
  brand: '#60a5fa',
  bar: '#818cf8',
  fixed: '#818cf8',
  flexible: '#fbbf24',
  axisLabel: '#8b95a3',
  legendText: '#aab4c0',
  gridLine: '#22272f',
  axisLine: '#262c35',
  surface: '#171b22',
};

export const CHART_PALETTES: Record<'light' | 'dark', ChartPalette> = {
  light: CHART_COLORS,
  dark: DARK_CHART_COLORS,
};

/** 文本类颜色：必须满足 WCAG AA（≥4.5:1），由测试守住 */
export const CHART_TEXT_COLORS = [CHART_COLORS.axisLabel, CHART_COLORS.legendText] as const;
export const DARK_CHART_TEXT_COLORS = [
  DARK_CHART_COLORS.axisLabel,
  DARK_CHART_COLORS.legendText,
] as const;

/** 把十六进制色转成带透明度的 rgba，用于面积图的渐变（深浅两套都能跟随） */
export function withAlpha(hex: string, alpha: number): string {
  const value = hex.trim().replace('#', '');
  const full =
    value.length === 3
      ? value
          .split('')
          .map((c) => c + c)
          .join('')
      : value;
  const r = parseInt(full.slice(0, 2), 16);
  const g = parseInt(full.slice(2, 4), 16);
  const b = parseInt(full.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}
