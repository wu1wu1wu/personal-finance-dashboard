// ============================================================
// PeriodicBreakdownChart - 固定开销 vs 弹性开销
//
// 图例用 HTML 渲染而不是 ECharts legend，窄屏不会压字。
// ============================================================

import ReactECharts from 'echarts-for-react';
import { ChartPie } from 'lucide-react';
import type { PeriodicBreakdown } from '@/core/periodic-engine';
import { formatCurrency } from '@/utils/format';

interface PeriodicBreakdownChartProps {
  data: PeriodicBreakdown;
}

const FIXED_COLOR = '#6366F1';
const FLEXIBLE_COLOR = '#F59E0B';

export default function PeriodicBreakdownChart({ data }: PeriodicBreakdownChartProps) {
  const total = data.fixedAmount + data.flexibleAmount;

  const heading = (
    <h3 className="mb-3 flex items-center gap-1.5 text-sm font-semibold text-ink">
      <ChartPie size={15} className="text-ink-subtle" aria-hidden="true" />
      固定 vs 弹性
    </h3>
  );

  if (total === 0) {
    return (
      <section className="rounded-2xl border border-line bg-surface p-4">
        {heading}
        <p className="py-8 text-center text-sm text-ink-subtle">本月暂无支出数据</p>
      </section>
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
    series: [
      {
        type: 'pie' as const,
        radius: ['58%', '86%'],
        center: ['50%', '50%'],
        padAngle: 2,
        itemStyle: { borderRadius: 3, borderColor: '#fff', borderWidth: 2 },
        label: { show: false },
        labelLine: { show: false },
        emphasis: { scaleSize: 4 },
        data: [
          { name: '固定开销', value: data.fixedAmount, itemStyle: { color: FIXED_COLOR } },
          { name: '弹性开销', value: data.flexibleAmount, itemStyle: { color: FLEXIBLE_COLOR } },
        ],
      },
    ],
  };

  const legend = [
    {
      label: '固定开销',
      color: FIXED_COLOR,
      percent: fixedPercent,
      amount: data.fixedAmount,
      count: data.fixedCount,
    },
    {
      label: '弹性开销',
      color: FLEXIBLE_COLOR,
      percent: flexiblePercent,
      amount: data.flexibleAmount,
      count: data.flexibleCount,
    },
  ];

  return (
    <section className="rounded-2xl border border-line bg-surface p-4">
      {heading}

      <div className="flex items-center gap-4">
        <div className="relative h-[132px] w-[132px] shrink-0">
          <ReactECharts
            option={option}
            style={{ height: 132, width: 132 }}
            opts={{ renderer: 'svg' }}
          />
          <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-[11px] text-ink-subtle">合计</span>
            <span className="tnum text-xs font-semibold text-ink">
              {formatCurrency(total)}
            </span>
          </div>
        </div>

        <ul className="min-w-0 flex-1 space-y-2.5">
          {legend.map((item) => (
            <li key={item.label}>
              <div className="flex items-center gap-1.5">
                <span
                  className="h-2.5 w-2.5 shrink-0 rounded-full"
                  style={{ backgroundColor: item.color }}
                  aria-hidden="true"
                />
                <span className="min-w-0 flex-1 truncate text-sm text-ink">{item.label}</span>
                <span className="tnum shrink-0 text-xs text-ink-subtle">{item.percent}%</span>
              </div>
              <p className="tnum mt-0.5 text-xs text-ink-muted">
                {formatCurrency(item.amount)} · {item.count} 笔
              </p>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
