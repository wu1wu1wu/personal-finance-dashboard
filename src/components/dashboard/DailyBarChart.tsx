// ============================================================
// DailyBarChart - 本月每日支出柱状图
// ============================================================

import { useMemo } from 'react';
import { ChartColumn } from 'lucide-react';
import EChart from '@/components/charts/EChart';
import { useChartLabels } from '@/components/charts/useChartLabels';
import { useChartColors } from '@/components/charts/useChartColors';
import { buildDailyOption, summarizeDaily } from '@/components/dashboard/chart-options';
import type { DailySpendPoint } from '@/core/dashboard-engine';
import { formatDayOfMonthForLocale, useLocale, useT } from '@/i18n';

interface DailyBarChartProps {
  data: DailySpendPoint[];
}

export default function DailyBarChart({ data }: DailyBarChartProps) {
  const palette = useChartColors();
  const labels = useChartLabels();
  const { t } = useT();
  const locale = useLocale();
  // core 给的 label 是写死的中文（"5日"），展示前按语言重算：中文仍是「5日」，英文只留数字
  const points = useMemo(
    () => data.map((d) => ({ ...d, label: formatDayOfMonthForLocale(locale, d.day) })),
    [data, locale],
  );
  const option = useMemo(
    () => buildDailyOption(points, palette, labels),
    [points, palette, labels],
  );
  const summary = useMemo(() => summarizeDaily(points, t), [points, t]);

  return (
    <section className="rounded-2xl border border-line bg-surface p-4">
      <h3 className="mb-3 flex items-center gap-1.5 text-sm font-semibold text-ink">
        <ChartColumn size={15} className="text-ink-subtle" aria-hidden="true" />
        {t('dashboard.dailyTitle')}
      </h3>
      <div role="img" aria-label={summary}>
        <EChart option={option} style={{ height: 220 }} />
      </div>
    </section>
  );
}
