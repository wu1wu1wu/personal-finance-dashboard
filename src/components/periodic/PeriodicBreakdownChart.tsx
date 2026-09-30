// ============================================================
// PeriodicBreakdownChart - 固定开销 vs 弹性开销
//
// 图例用 HTML 渲染而不是 ECharts legend，窄屏不会压字。
// ============================================================

import { useMemo } from 'react';
import { ChartPie } from 'lucide-react';
import EChart from '@/components/charts/EChart';
import { useChartLabels } from '@/components/charts/useChartLabels';
import { useChartColors } from '@/components/charts/useChartColors';
import {
  buildPeriodicBreakdownOption,
  summarizePeriodicBreakdown,
} from '@/components/dashboard/chart-options';
import type { PeriodicBreakdown } from '@/core/periodic-engine';
import { useT } from '@/i18n';
import { formatCurrency } from '@/utils/format';

interface PeriodicBreakdownChartProps {
  data: PeriodicBreakdown;
}

export default function PeriodicBreakdownChart({ data }: PeriodicBreakdownChartProps) {
  const total = data.fixedAmount + data.flexibleAmount;
  const palette = useChartColors();
  const labels = useChartLabels();
  const { t } = useT();
  const option = useMemo(
    () => buildPeriodicBreakdownOption(data, palette, labels),
    [data, palette, labels],
  );
  const summary = useMemo(() => summarizePeriodicBreakdown(data, t), [data, t]);

  const heading = (
    <h3 className="mb-3 flex items-center gap-1.5 text-sm font-semibold text-ink">
      <ChartPie size={15} className="text-ink-subtle" aria-hidden="true" />
      {t('periodic.breakdownTitle')}
    </h3>
  );

  if (total === 0) {
    return (
      <section className="rounded-2xl border border-line bg-surface p-4">
        {heading}
        <p className="py-8 text-center text-sm text-ink-subtle">
          {t('periodic.noExpenseThisMonth')}
        </p>
      </section>
    );
  }

  const fixedPercent = Math.round((data.fixedAmount / total) * 1000) / 10;
  const flexiblePercent = Math.round((data.flexibleAmount / total) * 1000) / 10;

  const legend = [
    {
      label: labels.fixed,
      color: palette.fixed,
      percent: fixedPercent,
      amount: data.fixedAmount,
      count: data.fixedCount,
    },
    {
      label: labels.flexible,
      color: palette.flexible,
      percent: flexiblePercent,
      amount: data.flexibleAmount,
      count: data.flexibleCount,
    },
  ];

  return (
    <section className="rounded-2xl border border-line bg-surface p-4">
      {heading}

      <div className="flex items-center gap-4">
        <div
          className="relative h-[132px] w-[132px] shrink-0"
          role="img"
          aria-label={summary}
        >
          <EChart option={option} style={{ height: 132, width: 132 }} />
          <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-[11px] text-ink-subtle">{t('common.total')}</span>
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
                {formatCurrency(item.amount)} · {t('common.count', { count: item.count })}
              </p>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
