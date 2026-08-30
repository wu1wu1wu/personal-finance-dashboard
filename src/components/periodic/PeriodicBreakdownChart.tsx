// ============================================================
// PeriodicBreakdownChart 组件 - 固定开销 vs 弹性开销对比图
// ============================================================

import ReactECharts from 'echarts-for-react';
import type { PeriodicBreakdown } from '@/core/periodic-engine';
import { formatCurrency } from '@/utils/format';

interface PeriodicBreakdownChartProps {
  data: PeriodicBreakdown;
}

export default function PeriodicBreakdownChart({ data }: PeriodicBreakdownChartProps) {
  const total = data.fixedAmount + data.flexibleAmount;

  // 无数据时显示空状态
  if (total === 0) {
    return (
      <div className="bg-white rounded-xl border border-gray-100 p-4">
        <h3 className="text-sm font-semibold text-gray-700 mb-3">📊 固定 vs 弹性</h3>
        <div className="text-center py-6 text-gray-400">
          <p className="text-sm">暂无当月支出数据</p>
        </div>
      </div>
    );
  }

  const fixedPercent = Math.round((data.fixedAmount / total) * 1000) / 10;
  const flexiblePercent = Math.round((data.flexibleAmount / total) * 1000) / 10;

  const option = {
    tooltip: {
      trigger: 'item' as const,
      formatter: (params: { name: string; value: number; percent: number }) =>
        `<div style="font-weight:600">${params.name}</div>
         <div>金额: ${formatCurrency(params.value)}</div>
         <div>占比: ${params.percent}%</div>`,
    },
    legend: {
      orient: 'vertical' as const,
      right: '5%',
      top: 'center',
      itemWidth: 12,
      itemHeight: 12,
      textStyle: { fontSize: 12, color: '#6B7280' },
      formatter: (name: string) => {
        if (name === '固定开销') return `📌 固定开销 ${fixedPercent}%`;
        return `💡 弹性开销 ${flexiblePercent}%`;
      },
    },
    series: [
      {
        type: 'pie' as const,
        radius: ['45%', '70%'],
        center: ['35%', '50%'],
        padAngle: 2,
        itemStyle: { borderRadius: 4 },
        label: { show: false },
        emphasis: {
          label: {
            show: true,
            fontSize: 13,
            fontWeight: 'bold',
            formatter: '{b}\n{d}%',
          },
        },
        data: [
          {
            name: '固定开销',
            value: data.fixedAmount,
            itemStyle: { color: '#6366F1' },
          },
          {
            name: '弹性开销',
            value: data.flexibleAmount,
            itemStyle: { color: '#F59E0B' },
          },
        ],
      },
    ],
  };

  return (
    <div className="bg-white rounded-xl border border-gray-100 p-4">
      <h3 className="text-sm font-semibold text-gray-700 mb-3">📊 固定 vs 弹性</h3>
      <ReactECharts option={option} style={{ height: 180 }} opts={{ renderer: 'svg' }} />
      {/* 底部摘要 */}
      <div className="flex items-center justify-between mt-2 text-xs text-gray-500">
        <span>
          固定 {data.fixedCount} 笔 · {formatCurrency(data.fixedAmount)}
        </span>
        <span>
          弹性 {data.flexibleCount} 笔 · {formatCurrency(data.flexibleAmount)}
        </span>
      </div>
    </div>
  );
}