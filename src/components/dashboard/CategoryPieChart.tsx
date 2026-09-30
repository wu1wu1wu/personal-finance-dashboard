// ============================================================
// CategoryPieChart - 分类占比（环形图 + 文字列表）
//
// 不用 ECharts 自带图例：图例在窄屏会互相压字且无法控制换行。
// 改成环形图配一份 HTML 列表，信息密度更高，也更好点。
// ============================================================

import { useMemo } from 'react';
import EChart from '@/components/charts/EChart';
import { useChartLabels } from '@/components/charts/useChartLabels';
import { useChartColors } from '@/components/charts/useChartColors';
import { buildPieOption } from '@/components/dashboard/chart-options';
import type { CategoryBreakdownPoint } from '@/core/dashboard-engine';
import { categoryLabel, useLocale, useT } from '@/i18n';
import { formatCurrency, formatCurrencyShort } from '@/utils/format';

interface CategoryPieChartProps {
  data: CategoryBreakdownPoint[];
  /** 点击某个分类时回调，用于跳转到明细页 */
  onCategoryClick?: (category: string) => void;
}

export default function CategoryPieChart({ data, onCategoryClick }: CategoryPieChartProps) {
  const total = data.reduce((sum, d) => sum + d.amount, 0);
  const palette = useChartColors();
  const labels = useChartLabels();
  const { t } = useT();
  const locale = useLocale();
  const option = useMemo(() => buildPieOption(data, palette, labels), [data, palette, labels]);

  const handleChartClick = (params: { name?: string; data?: { category?: string } }) => {
    // 扇区名是本地化过的，钻取必须用 category 原值
    const category = params.data?.category ?? params.name;
    if (onCategoryClick && category) onCategoryClick(category);
  };

  if (data.length === 0) {
    return (
      <section className="rounded-2xl border border-line bg-surface p-4">
        <h2 className="text-sm font-semibold text-ink">{t('dashboard.categoryPieTitle')}</h2>
        <p className="py-10 text-center text-sm text-ink-subtle">
          {t('dashboard.noExpenseThisMonth')}
        </p>
      </section>
    );
  }

  return (
    <section className="rounded-2xl border border-line bg-surface p-4">
      <div className="mb-2 flex items-baseline justify-between">
        <h2 className="text-sm font-semibold text-ink">{t('dashboard.categoryPieTitle')}</h2>
        {onCategoryClick && (
          <span className="text-xs text-ink-subtle">{t('dashboard.clickForDetail')}</span>
        )}
      </div>

      {/* 宽屏并排，窄屏上下堆叠，避免卡片拉出大片空白 */}
      <div className="md:flex md:items-center md:gap-6">
        {/* 环形图：中心显示本月支出合计。
            数据由右侧列表完整承载（可点击），所以这里对读屏软件隐藏，避免重复播报 */}
        <div
          className="relative mx-auto h-[148px] w-[148px] md:mx-0 md:shrink-0"
          aria-hidden="true"
        >
          <EChart option={option} style={{ height: 148, width: 148 }} onEvents={{ click: handleChartClick }} />
          <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-[11px] text-ink-subtle">{t('dashboard.monthExpense')}</span>
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
              <span className="min-w-0 flex-1 truncate text-sm text-ink">
                {categoryLabel(locale, d.category)}
              </span>
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
