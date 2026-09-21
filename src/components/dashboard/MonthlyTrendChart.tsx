// ============================================================
// MonthlyTrendChart - 月度支出/收入趋势
// ============================================================

import ReactECharts from 'echarts-for-react';
import { TrendingUp } from 'lucide-react';
import type { MonthlyTrendPoint } from '@/core/dashboard-engine';
import { formatCurrency } from '@/utils/format';

interface MonthlyTrendChartProps {
  data: MonthlyTrendPoint[];
}

const EXPENSE_COLOR = '#E5484D';
const INCOME_COLOR = '#0F9D58';

export default function MonthlyTrendChart({ data }: MonthlyTrendChartProps) {
  const option = {
    tooltip: {
      trigger: 'axis' as const,
      formatter: (params: Array<{ seriesName: string; value: number; axisValue: string }>) => {
        let html = `<div style="font-weight:600;margin-bottom:4px">${params[0]?.axisValue ?? ''}</div>`;
        for (const p of params) {
          const color = p.seriesName === '支出' ? EXPENSE_COLOR : INCOME_COLOR;
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
      textStyle: { fontSize: 12, color: '#667085' },
      itemWidth: 12,
      itemHeight: 8,
      itemGap: 16,
    },
    grid: {
      left: 10,
      right: 12,
      top: 12,
      bottom: 32,
      containLabel: true,
    },
    xAxis: {
      type: 'category' as const,
      data: data.map((d) => d.label),
      axisLine: { lineStyle: { color: '#E8EBF0' } },
      axisTick: { show: false },
      axisLabel: { fontSize: 11, color: '#98A1AE' },
    },
    yAxis: {
      type: 'value' as const,
      axisLine: { show: false },
      axisTick: { show: false },
      splitLine: { lineStyle: { color: '#F1F3F7', type: 'dashed' as const } },
      axisLabel: {
        fontSize: 11,
        color: '#98A1AE',
        formatter: (val: number) =>
          val >= 10000 ? `${(val / 10000).toFixed(0)}万` : `${val}`,
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
        lineStyle: { width: 2.5, color: EXPENSE_COLOR },
        itemStyle: { color: EXPENSE_COLOR },
        areaStyle: {
          color: {
            type: 'linear' as const,
            x: 0,
            y: 0,
            x2: 0,
            y2: 1,
            colorStops: [
              { offset: 0, color: 'rgba(229,72,77,0.14)' },
              { offset: 1, color: 'rgba(229,72,77,0.02)' },
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
        lineStyle: { width: 2.5, color: INCOME_COLOR },
        itemStyle: { color: INCOME_COLOR },
        areaStyle: {
          color: {
            type: 'linear' as const,
            x: 0,
            y: 0,
            x2: 0,
            y2: 1,
            colorStops: [
              { offset: 0, color: 'rgba(15,157,88,0.14)' },
              { offset: 1, color: 'rgba(15,157,88,0.02)' },
            ],
          },
        },
      },
    ],
  };

  return (
    <section className="rounded-2xl border border-line bg-surface p-4">
      <h3 className="mb-3 flex items-center gap-1.5 text-sm font-semibold text-ink">
        <TrendingUp size={15} className="text-ink-subtle" aria-hidden="true" />
        月度趋势
      </h3>
      <ReactECharts option={option} style={{ height: 240 }} opts={{ renderer: 'svg' }} />
    </section>
  );
}
