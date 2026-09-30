// ============================================================
// 图表 option 构造器（纯函数）
//
// 抽出来的两个理由：
// 1. 组件只剩渲染，配色与结构集中在一处，便于统一改；
// 2. 这些函数不依赖 React，可以在 node 环境里用 ECharts 的 SSR 模式
//    真渲染一遍（见 chart-options.test.ts），从而证明"按需注册"没漏组件。
// ============================================================

import { CHART_COLORS, withAlpha } from '@/constants/chart-colors';
import type { ChartPalette } from '@/constants/chart-colors';
import { formatCurrency } from '@/utils/format';
import type { ChartOption } from '@/components/charts/register';
import { createTranslator, interpolate } from '@/i18n/translate';
import type { Translate } from '@/i18n/translate';
import { charts as zhCharts } from '@/i18n/messages/zh-CN/charts';
import type { Locale } from '@/i18n/locale';
import type {
  CategoryBreakdownPoint,
  DailySpendPoint,
  MonthlyTrendPoint,
} from '@/core/dashboard-engine';
import type { PeriodicBreakdown } from '@/core/periodic-engine';

/**
 * 让坐标轴标签也参与布局（旧写法是 grid.containLabel: true）。
 * echarts 6 起 containLabel 已废弃，需要显式写 outerBounds*，
 * 否则开发期会打 "no use(LegacyGridContainLabel)" 的告警。
 */
const CONTAIN_LABEL = {
  outerBoundsMode: 'same',
  outerBoundsContain: 'axisLabel',
} as const;

/** 图表内的文案（ECharts 读不到 React hook，由调用方通过 t() 传进来） */
export interface ChartLabels {
  expense: string;
  income: string;
  amountLine: string; // '金额: {amount}'
  percentLine: string; // '占比: {percent}%'
  countLine: string; // '笔数: {count} 笔'
  dailyAverageLine: string; // '日均 {amount}'
  fixed: string;
  flexible: string;
  /**
   * 坐标轴数值的紧凑写法。
   * 中文按「万」、英文按「k」，两套的进位单位不同，
   * 所以这里给的是函数而不是一个后缀字符串——否则英文会被迫写成 '0k' 这种畸形后缀。
   */
  formatAxisValue: (value: number) => string;
}

/** 坐标轴数值压缩（纯函数，单独可测） */
export function buildAxisFormatter(locale: Locale): (value: number) => string {
  if (locale === 'en') {
    return (value) => (value >= 1000 ? `${Math.round(value / 1000)}k` : `${Math.round(value)}`);
  }
  return (value) =>
    value >= 10000 ? `${Math.round(value / 10000)}万` : `${Math.round(value)}`;
}

/**
 * 不传 labels 时的中文默认值，保证纯函数调用方（测试/SSR）不用管 i18n。
 * 文案直接从中文文案表派生，避免两处手抄导致漂移。
 */
export const DEFAULT_CHART_LABELS: ChartLabels = {
  expense: zhCharts['charts.expense'],
  income: zhCharts['charts.income'],
  amountLine: zhCharts['charts.tooltip.amount'],
  percentLine: zhCharts['charts.tooltip.percent'],
  countLine: zhCharts['charts.tooltip.count'],
  dailyAverageLine: zhCharts['charts.tooltip.dailyAverage'],
  fixed: zhCharts['charts.fixed'],
  flexible: zhCharts['charts.flexible'],
  formatAxisValue: buildAxisFormatter('zh-CN'),
};

/** 摘要函数的兜底翻译器（中文），调用方不传 t 时用它 */
const DEFAULT_TRANSLATE: Translate = createTranslator('zh-CN').t;

/** 月度支出/收入趋势折线图 */
export function buildTrendOption(
  data: MonthlyTrendPoint[],
  palette: ChartPalette = CHART_COLORS,
  labels: ChartLabels = DEFAULT_CHART_LABELS,
): ChartOption {
  return {
    tooltip: {
      trigger: 'axis',
      formatter: (params: unknown) => {
        const list = (Array.isArray(params) ? params : [params]) as Array<{
          seriesName: string;
          value: number;
          axisValue: string;
        }>;
        let html = `<div style="font-weight:600;margin-bottom:4px">${list[0]?.axisValue ?? ''}</div>`;
        for (const p of list) {
          const color = p.seriesName === labels.expense ? palette.expense : palette.income;
          html += `<div style="display:flex;align-items:center;gap:6px">
            <span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:${color}"></span>
            ${p.seriesName}: ${formatCurrency(p.value)}
          </div>`;
        }
        return html;
      },
    },
    legend: {
      data: [labels.expense, labels.income],
      bottom: 0,
      icon: 'roundRect',
      textStyle: { fontSize: 12, color: palette.legendText },
      itemWidth: 12,
      itemHeight: 8,
      itemGap: 16,
    },
    grid: { left: 10, right: 12, top: 12, bottom: 32, ...CONTAIN_LABEL },
    xAxis: {
      type: 'category',
      data: data.map((d) => d.label),
      axisLine: { lineStyle: { color: palette.axisLine } },
      axisTick: { show: false },
      axisLabel: { fontSize: 11, color: palette.axisLabel },
    },
    yAxis: {
      type: 'value',
      axisLine: { show: false },
      axisTick: { show: false },
      splitLine: { lineStyle: { color: palette.gridLine, type: 'dashed' } },
      axisLabel: {
        fontSize: 11,
        color: palette.axisLabel,
        formatter: (val: number) => labels.formatAxisValue(val),
      },
    },
    series: [
      {
        name: labels.expense,
        type: 'line',
        data: data.map((d) => d.expense),
        smooth: true,
        symbol: 'circle',
        symbolSize: 6,
        lineStyle: { width: 2.5, color: palette.expense },
        itemStyle: { color: palette.expense },
        areaStyle: {
          color: {
            type: 'linear',
            x: 0,
            y: 0,
            x2: 0,
            y2: 1,
            colorStops: [
              { offset: 0, color: withAlpha(palette.expense, 0.14) },
              { offset: 1, color: withAlpha(palette.expense, 0.02) },
            ],
          },
        },
      },
      {
        name: labels.income,
        type: 'line',
        data: data.map((d) => d.income),
        smooth: true,
        symbol: 'circle',
        symbolSize: 6,
        lineStyle: { width: 2.5, color: palette.income },
        itemStyle: { color: palette.income },
        areaStyle: {
          color: {
            type: 'linear',
            x: 0,
            y: 0,
            x2: 0,
            y2: 1,
            colorStops: [
              { offset: 0, color: withAlpha(palette.income, 0.14) },
              { offset: 1, color: withAlpha(palette.income, 0.02) },
            ],
          },
        },
      },
    ],
  };
}

/** 本月每日支出柱状图（含日均参考线） */
export function buildDailyOption(
  data: DailySpendPoint[],
  palette: ChartPalette = CHART_COLORS,
  labels: ChartLabels = DEFAULT_CHART_LABELS,
): ChartOption {
  const totalSpend = data.reduce((s, d) => s + d.amount, 0);
  const daysWithData = data.filter((d) => d.amount > 0).length;
  const dailyAvg = daysWithData > 0 ? totalSpend / daysWithData : 0;
  const highlightThreshold = dailyAvg * 1.5;

  return {
    tooltip: {
      trigger: 'axis',
      formatter: (params: unknown) => {
        const first = (Array.isArray(params) ? params[0] : params) as
          | { axisValue: string; value: number }
          | undefined;
        if (!first || first.value === 0) return '';
        return `<div style="font-weight:600">${first.axisValue}</div>
          <div>${labels.expense}: ${formatCurrency(first.value)}</div>`;
      },
    },
    grid: { left: 10, right: 16, top: 22, bottom: 5, ...CONTAIN_LABEL },
    xAxis: {
      type: 'category',
      data: data.map((d) => d.label),
      axisLine: { lineStyle: { color: palette.axisLine } },
      axisTick: { show: false },
      axisLabel: {
        fontSize: 10,
        color: palette.axisLabel,
        // 每天一个标签会糊成一片，只显示 1 号与每 5 天
        interval: (index: number) => index === 0 || (index + 1) % 5 === 0,
      },
    },
    yAxis: {
      type: 'value',
      axisLine: { show: false },
      axisTick: { show: false },
      splitLine: { lineStyle: { color: palette.gridLine, type: 'dashed' } },
      axisLabel: {
        fontSize: 10,
        color: palette.axisLabel,
        formatter: (val: number) => labels.formatAxisValue(val),
      },
    },
    series: [
      {
        type: 'bar',
        data: data.map((d) => ({
          value: d.amount,
          itemStyle: {
            borderRadius: [3, 3, 0, 0],
            color: d.amount > highlightThreshold ? palette.expense : palette.bar,
          },
        })),
        barMaxWidth: 12,
        markLine:
          dailyAvg > 0
            ? {
                silent: true,
                symbol: 'none',
                lineStyle: { color: palette.alert, type: 'dashed', width: 1.5 },
                label: {
                  formatter: interpolate(labels.dailyAverageLine, {
                    amount: formatCurrency(dailyAvg),
                  }),
                  fontSize: 10,
                  color: palette.alert,
                  // 贴左端显示，否则会被右边界裁掉
                  position: 'insideStartTop',
                },
                data: [{ yAxis: dailyAvg }],
              }
            : undefined,
      },
    ],
  };
}

/** 分类占比环形图 */
export function buildPieOption(
  data: CategoryBreakdownPoint[],
  palette: ChartPalette = CHART_COLORS,
  labels: ChartLabels = DEFAULT_CHART_LABELS,
): ChartOption {
  return {
    tooltip: {
      trigger: 'item',
      formatter: (params: unknown) => {
        const p = params as {
          name: string;
          value: number;
          percent: number;
          data: { count: number };
        };
        return `<div style="font-weight:600;margin-bottom:4px">${p.name}</div>
          <div>${interpolate(labels.amountLine, { amount: formatCurrency(p.value) })}</div>
          <div>${interpolate(labels.percentLine, { percent: p.percent })}</div>
          <div>${interpolate(labels.countLine, { count: p.data.count })}</div>`;
      },
    },
    series: [
      {
        type: 'pie',
        radius: ['62%', '88%'],
        center: ['50%', '50%'],
        padAngle: 2,
        itemStyle: {
          borderRadius: 3,
          borderColor: palette.surface,
          borderWidth: 2,
        },
        label: { show: false },
        labelLine: { show: false },
        emphasis: {
          scaleSize: 4,
          itemStyle: { shadowBlur: 8, shadowColor: 'rgba(0,0,0,0.12)' },
        },
        data: data.map((d) => ({
          // 扇区名按语言本地化，但 category 原值一并带上：
          // 点击钻取用的是 category，不能被本地化后的名字污染
          name: d.displayName ?? d.category,
          value: d.amount,
          itemStyle: { color: d.color },
          count: d.count,
          category: d.category,
        })),
      },
    ],
  };
}

/** 固定开销 vs 弹性开销环形图 */
export function buildPeriodicBreakdownOption(
  data: PeriodicBreakdown,
  palette: ChartPalette = CHART_COLORS,
  labels: ChartLabels = DEFAULT_CHART_LABELS,
): ChartOption {
  return {
    tooltip: {
      trigger: 'item',
      formatter: (params: unknown) => {
        const p = params as { name: string; value: number; percent: number };
        return `<div style="font-weight:600">${p.name}</div>
         <div>${interpolate(labels.amountLine, { amount: formatCurrency(p.value) })}</div>
         <div>${interpolate(labels.percentLine, { percent: p.percent })}</div>`;
      },
    },
    series: [
      {
        type: 'pie',
        radius: ['58%', '86%'],
        center: ['50%', '50%'],
        padAngle: 2,
        itemStyle: {
          borderRadius: 3,
          borderColor: palette.surface,
          borderWidth: 2,
        },
        label: { show: false },
        labelLine: { show: false },
        emphasis: { scaleSize: 4 },
        data: [
          { name: labels.fixed, value: data.fixedAmount, itemStyle: { color: palette.fixed } },
          {
            name: labels.flexible,
            value: data.flexibleAmount,
            itemStyle: { color: palette.flexible },
          },
        ],
      },
    ],
  };
}

// ----------------------------------------------------------
// 图表摘要：给屏幕阅读器用的文字替代
// ----------------------------------------------------------

/** 月度趋势的文字替代 */
export function summarizeTrend(
  data: MonthlyTrendPoint[],
  t: Translate = DEFAULT_TRANSLATE,
): string {
  if (data.length === 0) return t('charts.summary.trendEmpty');
  const peak = data.reduce((a, b) => (b.expense > a.expense ? b : a));
  const income = data.reduce((s, d) => s + d.income, 0);
  return t('charts.summary.trend', {
    months: data.length,
    peakLabel: peak.label,
    peakAmount: formatCurrency(peak.expense),
    income: formatCurrency(income),
  });
}

/** 每日支出的文字替代 */
export function summarizeDaily(data: DailySpendPoint[], t: Translate = DEFAULT_TRANSLATE): string {
  const total = data.reduce((s, d) => s + d.amount, 0);
  if (data.length === 0 || total === 0) return t('charts.summary.dailyEmpty');

  const daysWithData = data.filter((d) => d.amount > 0).length;
  const dailyAvg = total / daysWithData;
  const peak = data.reduce((a, b) => (b.amount > a.amount ? b : a));
  return t('charts.summary.daily', {
    days: data.length,
    average: formatCurrency(dailyAvg),
    peakAmount: formatCurrency(peak.amount),
    peakLabel: peak.label,
  });
}

/** 固定/弹性开销的文字替代 */
export function summarizePeriodicBreakdown(
  data: PeriodicBreakdown,
  t: Translate = DEFAULT_TRANSLATE,
): string {
  return t('charts.summary.periodic', {
    fixedAmount: formatCurrency(data.fixedAmount),
    fixedCount: data.fixedCount,
    flexibleAmount: formatCurrency(data.flexibleAmount),
    flexibleCount: data.flexibleCount,
  });
}
