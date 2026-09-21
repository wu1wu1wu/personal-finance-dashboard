// ============================================================
// CategoryPieChart - 分类占比（环形图 + 文字列表）
//
// 不用 ECharts 自带图例：图例在窄屏会互相压字且无法控制换行。
// 改成环形图配一份 HTML 列表，信息密度更高，也更好点。
// ============================================================

import ReactECharts from 'echarts-for-react';
import type { CategoryBreakdownPoint } from '@/core/dashboard-engine';
import { formatCurrency, formatCurrencyShort } from '@/utils/format';

interface CategoryPieChartProps {
  data: CategoryBreakdownPoint[];
  /** 点击某个分类时回调，用于跳转到明细页 */
  onCategoryClick?: (category: string) => void;
}

export default function CategoryPieChart({ data, onCategoryClick }: CategoryPieChartProps) {
  const total = data.reduce((sum, d) => sum + d.amount, 0);

  const option = {
    tooltip: {
      trigger: 'item' as const,
      formatter: (params: { name: string; value: number; percent: number; data: { count: number } }) =>
        `<div style="font-weight:600;margin-bottom:4px">${params.name}</div>
          <div>金额: ${formatCurrency(params.value)}</div>
          <div>占比: ${params.percent}%</div>
          <div>笔数: ${params.data.count} 笔</div>`,
    },
    series: [
      {
        type: 'pie',
        radius: ['62%', '88%'],
        center: ['50%', '50%'],
        padAngle: 2,
        itemStyle: {
          borderRadius: 3,
          borderColor: '#fff',
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

  const handleChartClick = (params: { name?: string }) => {
    if (onCategoryClick && params.name) onCategoryClick(params.name);
  };

  if (data.length === 0) {
    return (
      <section className="rounded-2xl border border-line bg-surface p-4">
        <h2 className="text-sm font-semibold text-ink">分类占比</h2>
        <p className="py-10 text-center text-sm text-ink-subtle">本月暂无支出</p>
      </section>
    );
  }

  return (
    <section className="rounded-2xl border border-line bg-surface p-4">
      <div className="mb-2 flex items-baseline justify-between">
        <h2 className="text-sm font-semibold text-ink">分类占比</h2>
        {onCategoryClick && <span className="text-xs text-ink-subtle">点击查看明细</span>}
      </div>

      {/* 宽屏并排，窄屏上下堆叠，避免卡片拉出大片空白 */}
      <div className="md:flex md:items-center md:gap-6">
        {/* 环形图：中心显示本月支出合计 */}
        <div className="relative mx-auto h-[148px] w-[148px] md:mx-0 md:shrink-0">
          <ReactECharts
            option={option}
            style={{ height: 148, width: 148 }}
            opts={{ renderer: 'svg' }}
            onEvents={{ click: handleChartClick }}
          />
          <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-[11px] text-ink-subtle">本月支出</span>
            <span className="tnum text-sm font-semibold text-ink">
              {formatCurrencyShort(total)}
            </span>
          </div>
        </div>

        {/* 分类列表 */}
        <ul className="mt-3 space-y-1 border-t border-line pt-3 md:mt-0 md:flex-1 md:border-l md:border-t-0 md:pl-6 md:pt-0">
        {data.map((d) => {
          const row = (
            <>
              <span
                className="h-2.5 w-2.5 shrink-0 rounded-full"
                style={{ backgroundColor: d.color }}
                aria-hidden="true"
              />
              <span className="min-w-0 flex-1 truncate text-sm text-ink">{d.category}</span>
              <span className="shrink-0 text-xs text-ink-subtle tnum">{d.percentage}%</span>
              <span className="w-[84px] shrink-0 text-right text-sm font-medium text-ink tnum">
                {formatCurrency(d.amount)}
              </span>
            </>
          );

          return (
            <li key={d.category}>
              {onCategoryClick ? (
                <button
                  type="button"
                  onClick={() => onCategoryClick(d.category)}
                  className="flex w-full items-center gap-2 rounded-lg px-1.5 py-2 text-left transition-colors hover:bg-canvas"
                >
                  {row}
                </button>
              ) : (
                <div className="flex items-center gap-2 px-1.5 py-2">{row}</div>
              )}
            </li>
          );
        })}
        </ul>
      </div>
    </section>
  );
}
