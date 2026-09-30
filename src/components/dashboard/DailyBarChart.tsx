// ============================================================
// DailyBarChart - 本月每日支出柱状图
// ============================================================

import { useMemo } from 'react';
import { ChartColumn } from 'lucide-react';
import EChart from '@/components/charts/EChart';
import { useChartColors } from '@/components/charts/useChartColors';
import { buildDailyOption, summarizeDaily } from '@/components/dashboard/chart-options';
import type { DailySpendPoint } from '@/core/dashboard-engine';

interface DailyBarChartProps {
  data: DailySpendPoint[];
}

export default function DailyBarChart({ data }: DailyBarChartProps) {
  const palette = useChartColors();
  const option = useMemo(() => buildDailyOption(data, palette), [data, palette]);
  const summary = useMemo(() => summarizeDaily(data), [data]);

  return (
    <section className="rounded-2xl border border-line bg-surface p-4">
      <h3 className="mb-3 flex items-center gap-1.5 text-sm font-semibold text-ink">
        <ChartColumn size={15} className="text-ink-subtle" aria-hidden="true" />
        每日支出
      </h3>
      <div role="img" aria-label={summary}>
        <EChart option={option} style={{ height: 220 }} />
      </div>
    </section>
  );
}
