// ============================================================
// MonthlyTrendChart - 月度支出/收入趋势
// ============================================================

import { useMemo } from 'react';
import { TrendingUp } from 'lucide-react';
import EChart from '@/components/charts/EChart';
import { buildTrendOption, summarizeTrend } from '@/components/dashboard/chart-options';
import type { MonthlyTrendPoint } from '@/core/dashboard-engine';

interface MonthlyTrendChartProps {
  data: MonthlyTrendPoint[];
}

export default function MonthlyTrendChart({ data }: MonthlyTrendChartProps) {
  const option = useMemo(() => buildTrendOption(data), [data]);
  const summary = useMemo(() => summarizeTrend(data), [data]);

  return (
    <section className="rounded-2xl border border-line bg-surface p-4">
      <h3 className="mb-3 flex items-center gap-1.5 text-sm font-semibold text-ink">
        <TrendingUp size={15} className="text-ink-subtle" aria-hidden="true" />
        月度趋势
      </h3>
      {/* 图表内容用 aria-label 概括，屏幕阅读器不必去读 SVG */}
      <div role="img" aria-label={summary}>
        <EChart option={option} style={{ height: 240 }} />
      </div>
    </section>
  );
}
