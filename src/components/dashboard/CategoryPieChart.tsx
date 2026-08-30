// ============================================================
// CategoryPieChart 组件 - 当月类别占比饼图（支持下钻点击）
// ============================================================

import ReactECharts from 'echarts-for-react';
import type { CategoryBreakdownPoint } from '@/core/dashboard-engine';
import { formatCurrency } from '@/utils/format';

interface CategoryPieChartProps {
  data: CategoryBreakdownPoint[];
  /** 点击分类时的回调（下钻查看明细） */
  onCategoryClick?: (category: string) => void;
}

export default function CategoryPieChart({ data, onCategoryClick }: CategoryPieChartProps) {
  const option = {
    tooltip: {
      trigger: 'item' as const,
      formatter: (params: { name: string; value: number; percent: number; data: { icon: string; count: number } }) => {
        const d = params.data as { icon: string; count: number };
        return `<div style="font-weight:600;margin-bottom:4px">${d.icon} ${params.name}</div>
          <div>金额: ${formatCurrency(params.value)}</div>
          <div>占比: ${params.percent}%</div>
          <div>笔数: ${d.count} 笔</div>`;
      },
    },
    legend: {
      orient: 'horizontal' as const,
      left: 'center' as const,
      bottom: 0,
      textStyle: { fontSize: 11, color: '#6B7280' },
      itemWidth: 10,
      itemHeight: 10,
      itemGap: 6,
      formatter: (name: string) => {
        const item = data.find((d) => d.category === name);
        if (!item) return name;
        return `${item.icon} ${name} ${item.percentage}%`;
      },
    },
    series: [
      {
        type: 'pie',
        radius: ['40%', '70%'],
        center: ['50%', '45%'],
        avoidLabelOverlap: false,
        padAngle: 2,
        itemStyle: {
          borderRadius: 4,
          borderColor: '#fff',
          borderWidth: 2,
        },
        label: {
          show: false,
        },
        emphasis: {
          label: {
            show: true,
            fontSize: 13,
            fontWeight: 'bold' as const,
            formatter: (params: { name: string; percent: number }) => {
              const item = data.find((d) => d.category === params.name);
              return item ? `${item.icon} ${params.name}\n${params.percent}%` : params.name;
            },
          },
          itemStyle: {
            shadowBlur: 10,
            shadowOffsetX: 0,
            shadowColor: 'rgba(0,0,0,0.1)',
          },
        },
        data: data.map((d) => ({
          name: d.category,
          value: d.amount,
          itemStyle: { color: d.color },
          icon: d.icon,
          count: d.count,
        })),
      },
    ],
  };

  const handleChartClick = (params: { name: string }) => {
    if (onCategoryClick && params.name) {
      onCategoryClick(params.name);
    }
  };

  // 空数据提示
  if (data.length === 0) {
    return (
      <div className="bg-white rounded-xl border border-gray-100 p-4">
        <h3 className="text-sm font-semibold text-gray-700 mb-3">🥧 分类占比</h3>
        <div className="flex items-center justify-center h-48 text-gray-400 text-sm">
          暂无当月支出数据
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl border border-gray-100 p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-gray-700">🥧 分类占比</h3>
        {onCategoryClick && (
          <span className="text-xs text-gray-400">点击分类查看明细</span>
        )}
      </div>
      <ReactECharts
        option={option}
        style={{ height: 260 }}
        opts={{ renderer: 'svg' }}
        onEvents={{ click: handleChartClick }}
      />
    </div>
  );
}