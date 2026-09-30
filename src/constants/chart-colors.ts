// ============================================================
// 图表配色 - 与 src/index.css 里的 @theme 令牌保持一致的单一来源
//
// 为什么单独放一份 TS 常量：ECharts 的 option 只接受字符串色值，
// 读不到 CSS 变量（且 SSR 渲染时没有 DOM）。所以这里与 CSS 令牌成对维护，
// 并由 chart-colors.test.ts 的对比度断言守住：改色若低于 4.5:1 会失败。
//
// 改动时同步 src/index.css 的 @theme。
// ============================================================

export const CHART_COLORS = {
  /** 支出（--color-expense） */
  expense: '#c92a2e',
  /** 收入（--color-income） */
  income: '#0b7a44',
  /** 预警 / 参考线（--color-alert） */
  alert: '#b45309',
  /** 主色（--color-brand） */
  brand: '#2563eb',
  /** 柱状图主色：比主色更深，柱体才够醒目 */
  bar: '#4f46e5',
  /** 固定开销（与 bar 同色系） */
  fixed: '#4f46e5',
  /** 弹性开销（与预警同色系） */
  flexible: '#b45309',

  /** 坐标轴标签文字（--color-ink-subtle） */
  axisLabel: '#6b7280',
  /** 图例文字（--color-ink-muted） */
  legendText: '#5b6675',
  /** 网格虚线：装饰用，不受文本对比度约束 */
  gridLine: '#f1f3f7',
  axisLine: '#e8ebf0',
  /** 环形图分块描边：与卡片底色一致 */
  surface: '#ffffff',
} as const;

/** 文本类颜色：必须满足 WCAG AA（≥4.5:1），由测试守住 */
export const CHART_TEXT_COLORS = [CHART_COLORS.axisLabel, CHART_COLORS.legendText] as const;
