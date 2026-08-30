// ============================================================
// MonthlyTrendChart 组件 - 月度支出趋势折线图
// ============================================================

import ReactECharts from 'echarts-for-react';
import type { MonthlyTrendPoint } from '@/core/dashboard-engine';
import { formatCurrency } from '@/utils/format';

interface MonthlyTrendChartProps {
  data: MonthlyTrendPoint[];
}

export default function MonthlyTrendChart({ data }: MonthlyTrendChartProps) {
  const option = {
    tooltip: {
      trigger: 'axis' as const,
      formatter: (params: Array<{ seriesName: string; value: number; axisValue: string }>) => {
        let html = `<div style="font-weight:600;margin-bottom:4px">${params[0]?.axisValue ?? ''}</div>`;
        for (const p of params) {
          const color = p.seriesName === '支出' ? '#EF4444' : '#10B981';
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
      textStyle: { fontSize: 12, color: '#6B7280' },
      itemWidth: 12,
      itemHeight: 8,
    },
    grid: {
      left: 10,
      right: 10,
      top: 10,
      bottom: 30,
      containLabel: true,
    },
    xAxis: {
      type: 'category' as const,
      data: data.map((d) => d.label),
      axisLine: { lineStyle: { color: '#E5E7EB' } },
      axisTick: { show: false },
      axisLabel: { fontSize: 11, color: '#9CA3AF' },
    },
    yAxis: {
      type: 'value' as const,
      axisLine: { show: false },
      axisTick: { show: false },
      splitLine: { lineStyle: { color: '#F3F4F6', type: 'dashed' as const } },
      axisLabel: {
        fontSize: 11,
        color: '#9CA3AF',
        formatter: (val: number) => val >= 10000 ? `${(val / 10000).toFixed(0)}万` : `${val}`,
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
        lineStyle: { width: 2.5, color: '#EF4444' },
        itemStyle: { color: '#EF4444' },
        areaStyle: {
          color: {
            type: 'linear' as const,
            x: 0, y: 0, x2: 0, y2: 1,
            colorStops: [
              { offset: 0, color: 'rgba(239,68,68,0.15)' },
              { offset: 1, color: 'rgba(239,68,68,0.02)' },
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
        lineStyle: { width: 2.5, color: '#10B981' },
        itemStyle: { color: '#10B981' },
        areaStyle: {
          color: {
            type: 'linear' as const,
            x: 0, y: 0, x2: 0, y2: 1,
            colorStops: [
              { offset: 0, color: 'rgba(16,185,129,0.15)' },
              { offset: 1, color: 'rgba(16,185,129,0.02)' },
            ],
          },
        },
      },
    ],
  };

  return (
    <div className="bg-white rounded-xl border border-gray-100 p-4">
      <h3 className="text-sm font-semibold text-gray-700 mb-3">📈 月度趋势</h3>
      <ReactECharts option={option} style={{ height: 260 }} opts={{ renderer: 'svg' }} />
    </div>
  );
}