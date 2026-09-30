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

/** 月度支出/收入趋势折线图 */
export function buildTrendOption(data: MonthlyTrendPoint[], palette: ChartPalette = CHART_COLORS): ChartOption {
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
          const color = p.seriesName === '支出' ? palette.expense : palette.income;
          html += `<div style="display:flex;align-items:center;gap:6px">
            <span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:${color}"></span>
            ${p.seriesName}: ${formatCurrency(p.value)}
          </div>`;
        }
        return html;
      },
    },
    legend: {
      data: ['支出', '收入'],
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
        formatter: (val: number) => (val >= 10000 ? `${(val / 10000).toFixed(0)}万` : `${val}`),
      },
    },
    series: [
      {
        name: '支出',
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
        name: '收入',
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
export function buildDailyOption(data: DailySpendPoint[], palette: ChartPalette = CHART_COLORS): ChartOption {
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
          <div>支出: ${formatCurrency(first.value)}</div>`;
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
        formatter: (val: number) => (val >= 1000 ? `${(val / 1000).toFixed(0)}k` : `${val}`),
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
                  formatter: `日均 ${formatCurrency(dailyAvg)}`,
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
export function buildPieOption(data: CategoryBreakdownPoint[], palette: ChartPalette = CHART_COLORS): ChartOption {
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
          <div>金额: ${formatCurrency(p.value)}</div>
          <div>占比: ${p.percent}%</div>
          <div>笔数: ${p.data.count} 笔</div>`;
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
          name: d.category,
          value: d.amount,
          itemStyle: { color: d.color },
          count: d.count,
        })),
      },
    ],
  };
}

/** 固定开销 vs 弹性开销环形图 */
export function buildPeriodicBreakdownOption(data: PeriodicBreakdown, palette: ChartPalette = CHART_COLORS): ChartOption {
  return {
    tooltip: {
      trigger: 'item',
      formatter: (params: unknown) => {
        const p = params as { name: string; value: number; percent: number };
        return `<div style="font-weight:600">${p.name}</div>
         <div>金额: ${formatCurrency(p.value)}</div>
         <div>占比: ${p.percent}%</div>`;
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
          { name: '固定开销', value: data.fixedAmount, itemStyle: { color: palette.fixed } },
          {
            name: '弹性开销',
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
export function summarizeTrend(data: MonthlyTrendPoint[]): string {
  if (data.length === 0) return '月度支出与收入趋势：暂无数据';
  const peak = data.reduce((a, b) => (b.expense > a.expense ? b : a));
  const income = data.reduce((s, d) => s + d.income, 0);
  return `月度支出与收入趋势折线图，共 ${data.length} 个月；支出最高的是 ${peak.label}，${formatCurrency(
    peak.expense,
  )}；期间收入合计 ${formatCurrency(income)}`;
}

/** 每日支出的文字替代 */
export function summarizeDaily(data: DailySpendPoint[]): string {
  const total = data.reduce((s, d) => s + d.amount, 0);
  if (data.length === 0 || total === 0) return '每日支出柱状图：本月暂无支出';

  const daysWithData = data.filter((d) => d.amount > 0).length;
  const dailyAvg = total / daysWithData;
  const peak = data.reduce((a, b) => (b.amount > a.amount ? b : a));
  return `每日支出柱状图，共 ${data.length} 天；日均 ${formatCurrency(dailyAvg)}，最高 ${formatCurrency(
    peak.amount,
  )}（${peak.label}）`;
}

/** 固定/弹性开销的文字替代 */
export function summarizePeriodicBreakdown(data: PeriodicBreakdown): string {
  return `固定与弹性开销环形图：固定开销 ${formatCurrency(
    data.fixedAmount,
  )}（${data.fixedCount} 笔），弹性开销 ${formatCurrency(data.flexibleAmount)}（${
    data.flexibleCount
  } 笔）`;
}
