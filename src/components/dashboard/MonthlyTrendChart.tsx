// ============================================================
// MonthlyTrendChart - 月度支出/收入趋势
// ============================================================

import { useMemo } from 'react';
import { TrendingUp } from 'lucide-react';
import EChart from '@/components/charts/EChart';
import { useChartLabels } from '@/components/charts/useChartLabels';
import { useChartColors } from '@/components/charts/useChartColors';
import { buildTrendOption, summarizeTrend } from '@/components/dashboard/chart-options';
import type { MonthlyTrendPoint } from '@/core/dashboard-engine';
import { formatMonthShortForLocale, useLocale, useT } from '@/i18n';

interface MonthlyTrendChartProps {
  data: MonthlyTrendPoint[];
}

export default function MonthlyTrendChart({ data }: MonthlyTrendChartProps) {
  const palette = useChartColors();
  const labels = useChartLabels();
  const { t } = useT();
  const locale = useLocale();
  // core 给的 label 是写死的中文（"7月"），展示前按语言重算，坐标轴与摘要共用这份
  const points = useMemo(
    () => data.map((d) => ({ ...d, label: formatMonthShortForLocale(locale, d.month) })),
    [data, locale],
  );
  const option = useMemo(
    () => buildTrendOption(points, palette, labels),
    [points, palette, labels],
  );
  const summary = useMemo(() => summarizeTrend(points, t), [points, t]);

  return (
    <section className="rounded-2xl border border-line bg-surface p-4">
      <h3 className="mb-3 flex items-center gap-1.5 text-sm font-semibold text-ink">
        <TrendingUp size={15} className="text-ink-subtle" aria-hidden="true" />
        {t('dashboard.trendTitle')}
      </h3>
      {/* 图表内容用 aria-label 概括，屏幕阅读器不必去读 SVG */}
      <div role="img" aria-label={summary}>
        <EChart option={option} style={{ height: 240 }} />
      </div>
    </section>
  );
}
