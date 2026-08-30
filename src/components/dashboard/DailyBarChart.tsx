// ============================================================
// DailyBarChart 组件 - 当月每日支出柱状图
// ============================================================

import ReactECharts from 'echarts-for-react';
import type { DailySpendPoint } from '@/core/dashboard-engine';
import { formatCurrency } from '@/utils/format';

interface DailyBarChartProps {
  data: DailySpendPoint[];
}

export default function DailyBarChart({ data }: DailyBarChartProps) {
  // 计算日均值（用于参考线和高亮）
  const totalSpend = data.reduce((s, d) => s + d.amount, 0);
  const daysWithData = data.filter((d) => d.amount > 0).length;
  const dailyAvg = daysWithData > 0 ? totalSpend / daysWithData : 0;
  const highlightThreshold = dailyAvg * 1.5;

  const option = {
    tooltip: {
      trigger: 'axis' as const,
      formatter: (params: Array<{ axisValue: string; value: number }>) => {
        const p = params[0];
        if (!p || p.value === 0) return '';
        return `<div style="font-weight:600">${p.axisValue}</div>
          <div>支出: ${formatCurrency(p.value)}</div>`;
      },
    },
    grid: {
      left: 10,
      right: 10,
      top: 15,
      bottom: 5,
      containLabel: true,
    },
    xAxis: {
      type: 'category' as const,
      data: data.map((d) => d.label),
      axisLine: { lineStyle: { color: '#E5E7EB' } },
      axisTick: { show: false },
      axisLabel: {
        fontSize: 10,
        color: '#9CA3AF',
        interval: (index: number) => {
          const day = index + 1;
          return day === 1 || day % 5 === 0;
        },
      },
    },
    yAxis: {
      type: 'value' as const,
      axisLine: { show: false },
      axisTick: { show: false },
      splitLine: { lineStyle: { color: '#F3F4F6', type: 'dashed' as const } },
      axisLabel: {
        fontSize: 10,
        color: '#9CA3AF',
        formatter: (val: number) => (val >= 1000 ? `${(val / 1000).toFixed(0)}k` : `${val}`),
      },
    },
    series: [
      {
        type: 'bar' as const,
        data: data.map((d) => ({
          value: d.amount,
          itemStyle: {
            borderRadius: [3, 3, 0, 0],
            color: d.amount > highlightThreshold ? '#EF4444' : '#6366F1',
          },
        })),
        barMaxWidth: 12,
        markLine: dailyAvg > 0
          ? {
              silent: true,
              symbol: 'none' as const,
              lineStyle: { color: '#F59E0B', type: 'dashed' as const, width: 1.5 },
              label: {
                formatter: `日均 ${formatCurrency(dailyAvg)}`,
                fontSize: 10,
                color: '#F59E0B',
              },
              data: [{ yAxis: dailyAvg }],
            }
          : undefined,
      },
    ],
  };

  return (
    <div className="bg-white rounded-xl border border-gray-100 p-4">
      <h3 className="text-sm font-semibold text-gray-700 mb-3">📊 每日支出</h3>
      <ReactECharts option={option} style={{ height: 220 }} opts={{ renderer: 'svg' }} />
    </div>
  );
}