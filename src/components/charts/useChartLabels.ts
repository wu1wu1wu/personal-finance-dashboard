// ============================================================
// useChartLabels - 把图表文案从 i18n 取出来喂给纯函数 option 构造器
//
// ECharts 读不到 React hook，option 构造器（chart-options.ts）也不能依赖 React，
// 所以两边通过 ChartLabels 这组字符串对接：这里取文案，那里只负责拼结构。
// ============================================================

import { useMemo } from 'react';
import { useT } from '@/i18n';
import { buildAxisFormatter } from '@/components/dashboard/chart-options';
import type { ChartLabels } from '@/components/dashboard/chart-options';

export function useChartLabels(): ChartLabels {
  const { t, locale } = useT();

  // t 只在语言变化时换引用（useT 内部按 locale 缓存），语言一变这里就重算
  return useMemo(
    () => ({
      expense: t('charts.expense'),
      income: t('charts.income'),
      amountLine: t('charts.tooltip.amount'),
      percentLine: t('charts.tooltip.percent'),
      countLine: t('charts.tooltip.count'),
      dailyAverageLine: t('charts.tooltip.dailyAverage'),
      fixed: t('charts.fixed'),
      flexible: t('charts.flexible'),
      // 中文按万、英文按 k：进位单位不同，所以交给函数
      formatAxisValue: buildAxisFormatter(locale),
    }),
    [t, locale],
  );
}
