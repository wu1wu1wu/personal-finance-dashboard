// ============================================================
// Report - 月度报告
//
// 看板回答「现在怎么样」，报告回答「这个月到底发生了什么」：
// 环比、分类结构、每日节奏、最大一笔、周期扣款、预算执行。
// 数字全部来自 report-engine，页面只负责排版与文案。
// ============================================================

import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { ChevronLeft, ChevronRight, ClipboardCheck, Copy, FileText } from 'lucide-react';
import EChart from '@/components/charts/EChart';
import { useChartColors } from '@/components/charts/useChartColors';
import { useChartLabels } from '@/components/charts/useChartLabels';
import { buildDailyOption, summarizeDaily } from '@/components/dashboard/chart-options';
import type { DailySpendPoint } from '@/core/dashboard-engine';
import { buildMonthlyReport } from '@/core/report-engine';
import { buildReportInsights } from '@/components/report/report-insights';
import {
  categoryLabel,
  formatDateForLocale,
  formatDayOfMonthForLocale,
  formatMonthForLocale,
  parseMonthParts,
  useLocale,
  useT,
} from '@/i18n';
import { useBudgetStore } from '@/stores/budget-store';
import { useTransactionStore } from '@/stores/transaction-store';
import { CATEGORIES } from '@/types';
import { getCurrentMonth, getTodayLocal, shiftMonthKey } from '@/utils/date';
import { formatAmount, formatCurrency } from '@/utils/format';
import { cn } from '@/utils/cn';

/** 环比标签：支出涨了不是好事，用支出色；其他项用中性色 */
function DeltaBadge({ value, colorize = false }: { value: number | null; colorize?: boolean }) {
  const { t } = useT();

  if (value === null) {
    return <span className="text-[11px] text-ink-subtle">{t('report.delta.none')}</span>;
  }

  const up = value > 0;
  return (
    <span
      className={cn(
        'text-[11px]',
        colorize ? (up ? 'text-expense' : 'text-income') : 'text-ink-subtle',
      )}
    >
      {t(up ? 'report.delta.up' : 'report.delta.down', { percent: Math.abs(value) })}
    </span>
  );
}

export default function Report() {
  const { t } = useT();
  const locale = useLocale();
  const labels = useChartLabels();
  const palette = useChartColors();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [copied, setCopied] = useState(false);

  const { transactions, loaded, loadFromStorage } = useTransactionStore();
  const { totalBudgets, loadFromStorage: loadBudgets } = useBudgetStore();

  useEffect(() => {
    loadFromStorage();
    void loadBudgets();
  }, [loadFromStorage, loadBudgets]);

  // 月份来自 URL，非法值回到本月
  const monthParam = searchParams.get('month');
  const month = parseMonthParts(monthParam ?? '') ? (monthParam as string) : getCurrentMonth();
  const isCurrentMonth = month >= getCurrentMonth();

  const report = useMemo(
    () =>
      buildMonthlyReport({
        transactions,
        month,
        totalBudgets,
        today: getTodayLocal(),
      }),
    [transactions, month, totalBudgets],
  );

  const insights = useMemo(() => buildReportInsights(report, locale), [report, locale]);

  // 日度数据的 x 轴只用「几号」，图表里就不会出现完整日期
  const dailyPoints = useMemo<DailySpendPoint[]>(
    () =>
      report.daily.map((point) => ({
        day: point.day,
        label: formatDayOfMonthForLocale(locale, point.day),
        amount: point.expense,
      })),
    [report.daily, locale],
  );
  const dailyOption = useMemo(
    () => buildDailyOption(dailyPoints, palette, labels),
    [dailyPoints, palette, labels],
  );
  const dailySummary = useMemo(() => summarizeDaily(dailyPoints, t), [dailyPoints, t]);

  const goToMonth = (next: string) => {
    setSearchParams(next === getCurrentMonth() ? {} : { month: next });
  };

  /** 复制一份纯文字版，方便贴到聊天里 */
  const handleCopy = async () => {
    const lines = [
      `${formatMonthForLocale(locale, month)} · ${t('report.title')}`,
      `${t('report.kpi.expense')}: ${formatCurrency(report.expense)}`,
      `${t('report.kpi.income')}: ${formatCurrency(report.income)}`,
      `${t('report.kpi.net')}: ${formatCurrency(report.net)}`,
      `${t('report.kpi.dailyAverage')}: ${formatCurrency(report.dailyAverage)}`,
      `${t('report.kpi.count')}: ${report.transactionCount}`,
      ...insights.map((insight) => `- ${t(insight.key, insight.params)}`),
    ];

    try {
      await navigator.clipboard.writeText(lines.join('\n'));
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // 剪贴板不可用（非 HTTPS、无权限）时不做误导性提示
    }
  };

  const isLoading = !loaded;
  const topAmount = report.topCategories[0]?.amount ?? 0;

  return (
    <div className="space-y-4">
      {/* 标题与月份切换 */}
      <div className="flex items-center justify-between gap-3">
        <h1 className="flex items-center gap-2 text-xl font-semibold text-ink">
          <FileText size={19} className="text-ink-subtle" aria-hidden="true" />
          {t('report.title')}
        </h1>

        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => goToMonth(shiftMonthKey(month, -1))}
            aria-label={t('report.prevMonth')}
            className="flex h-11 w-11 items-center justify-center rounded-lg text-ink-muted transition-colors hover:bg-canvas hover:text-ink"
          >
            <ChevronLeft size={18} aria-hidden="true" />
          </button>
          <span className="tnum min-w-[7.5rem] text-center text-sm font-medium text-ink">
            {formatMonthForLocale(locale, month)}
          </span>
          <button
            type="button"
            onClick={() => goToMonth(shiftMonthKey(month, 1))}
            disabled={isCurrentMonth}
            aria-label={t('report.nextMonth')}
            className="flex h-11 w-11 items-center justify-center rounded-lg text-ink-muted transition-colors hover:bg-canvas hover:text-ink disabled:opacity-40 disabled:hover:bg-transparent"
          >
            <ChevronRight size={18} aria-hidden="true" />
          </button>
        </div>
      </div>

      <p className="px-1 text-xs text-ink-subtle">{t('report.description')}</p>

      {isLoading && (
        <p className="py-12 text-center text-sm text-ink-subtle">{t('common.loading')}</p>
      )}

      {!isLoading && !report.hasData && (
        <div className="rounded-2xl border border-line bg-surface px-4 py-14 text-center">
          <p className="text-base font-medium text-ink">{t('report.empty')}</p>
          <p className="mt-1 text-sm text-ink-subtle">{t('report.emptyHint')}</p>
        </div>
      )}

      {!isLoading && report.hasData && (
        <>
          {/* 收支总览 */}
          <section className="rounded-2xl border border-line bg-surface p-5">
            <p className="text-xs text-ink-subtle">{t('report.kpi.expense')}</p>
            <p className="mt-1 flex items-baseline gap-1">
              <span className="tnum text-[32px] font-semibold leading-none text-expense">
                {formatAmount(report.expense)}
              </span>
              <span className="text-sm text-expense">{t('common.yuan')}</span>
            </p>
            <p className="mt-1.5">
              <DeltaBadge value={report.deltas.expense} colorize />
            </p>

            <div className="mt-4 grid grid-cols-2 gap-3 border-t border-line pt-3.5 sm:grid-cols-4">
              <div>
                <p className="text-xs text-ink-subtle">{t('report.kpi.income')}</p>
                <p className="tnum mt-0.5 text-sm font-medium text-income">
                  {formatCurrency(report.income)}
                </p>
                <DeltaBadge value={report.deltas.income} />
              </div>
              <div>
                <p className="text-xs text-ink-subtle">{t('report.kpi.net')}</p>
                <p
                  className={cn(
                    'tnum mt-0.5 text-sm font-medium',
                    report.net >= 0 ? 'text-ink' : 'text-ink-muted',
                  )}
                >
                  {report.net >= 0 ? '' : '-'}
                  {formatCurrency(Math.abs(report.net))}
                </p>
                <DeltaBadge value={report.deltas.net} />
              </div>
              <div>
                <p className="text-xs text-ink-subtle">{t('report.kpi.dailyAverage')}</p>
                <p className="tnum mt-0.5 text-sm font-medium text-ink">
                  {formatCurrency(report.dailyAverage)}
                </p>
              </div>
              <div>
                <p className="text-xs text-ink-subtle">{t('report.kpi.count')}</p>
                <p className="tnum mt-0.5 text-sm font-medium text-ink">{report.transactionCount}</p>
              </div>
            </div>
          </section>

          {/* 本月要点 */}
          {insights.length > 0 && (
            <section className="rounded-2xl border border-line bg-surface p-4">
              <div className="flex items-center justify-between gap-2">
                <h2 className="text-sm font-semibold text-ink">{t('report.insight.title')}</h2>
                <button
                  type="button"
                  onClick={() => void handleCopy()}
                  className="flex min-h-11 items-center gap-1.5 rounded-lg px-3 text-xs text-brand transition-colors hover:bg-brand-soft"
                >
                  {copied ? (
                    <ClipboardCheck size={14} aria-hidden="true" />
                  ) : (
                    <Copy size={14} aria-hidden="true" />
                  )}
                  {copied ? t('common.copied') : t('report.copyText')}
                </button>
              </div>
              <ul className="mt-1 space-y-1.5">
                {insights.map((insight) => (
                  <li key={insight.key} className="flex gap-2 text-sm text-ink-muted">
                    <span
                      className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-brand"
                      aria-hidden="true"
                    />
                    {t(insight.key, insight.params)}
                  </li>
                ))}
              </ul>
            </section>
          )}

          {/* 分类 TOP5 */}
          <section className="rounded-2xl border border-line bg-surface p-4">
            <div className="mb-2 flex items-center justify-between">
              <h2 className="text-sm font-semibold text-ink">{t('report.topCategories')}</h2>
              <button
                type="button"
                onClick={() => navigate(`/transactions?month=${month}`)}
                className="text-xs text-brand hover:underline"
              >
                {t('report.viewAll')}
              </button>
            </div>

            {report.topCategories.length === 0 ? (
              <p className="py-6 text-center text-sm text-ink-subtle">
                {t('report.topCategoriesEmpty')}
              </p>
            ) : (
              <ul className="space-y-2.5">
                {report.topCategories.map((row) => {
                  const icon =
                    CATEGORIES.find((category) => category.name === row.category)?.icon ?? '📌';
                  return (
                    <li key={row.category}>
                      <div className="flex items-center justify-between gap-2 text-sm">
                        <span className="flex min-w-0 items-center gap-1.5 text-ink">
                          <span aria-hidden="true">{icon}</span>
                          <span className="truncate">{categoryLabel(locale, row.category)}</span>
                          <span className="shrink-0 text-[11px] text-ink-subtle">
                            {t('common.count', { count: row.count })}
                          </span>
                        </span>
                        <span className="tnum shrink-0 font-medium text-ink">
                          {formatCurrency(row.amount)}
                        </span>
                      </div>
                      <div className="mt-1 flex items-center gap-2">
                        <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-canvas">
                          <div
                            className="h-full rounded-full bg-brand"
                            style={{
                              width: `${topAmount > 0 ? Math.round((row.amount / topAmount) * 100) : 0}%`,
                            }}
                          />
                        </div>
                        <span className="tnum w-10 shrink-0 text-right text-[11px] text-ink-subtle">
                          {row.percentage}%
                        </span>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>

          {/* 每日支出 */}
          <section className="rounded-2xl border border-line bg-surface p-4">
            <h2 className="mb-3 text-sm font-semibold text-ink">{t('report.dailyTitle')}</h2>
            <div role="img" aria-label={dailySummary}>
              <EChart option={dailyOption} style={{ height: 200 }} />
            </div>
          </section>

          {/* 最大一笔 / 周期扣款 / 待确认 / 预算 */}
          <section className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-2xl border border-line bg-surface p-4">
              <h2 className="text-sm font-semibold text-ink">{t('report.largestTitle')}</h2>
              {report.largestExpense ? (
                <>
                  <p className="tnum mt-2 text-xl font-semibold text-ink">
                    {formatCurrency(report.largestExpense.amount)}
                  </p>
                  <p className="mt-1 text-xs text-ink-subtle">
                    {t('report.largestOn', {
                      date: formatDateForLocale(locale, report.largestExpense.date),
                      name:
                        report.largestExpense.counterparty ||
                        report.largestExpense.description ||
                        '-',
                    })}
                  </p>
                </>
              ) : (
                <p className="py-4 text-sm text-ink-subtle">{t('report.topCategoriesEmpty')}</p>
              )}
            </div>

            <div className="rounded-2xl border border-line bg-surface p-4">
              <h2 className="text-sm font-semibold text-ink">{t('report.periodicTitle')}</h2>
              {report.periodics.length > 0 ? (
                <>
                  <p className="tnum mt-2 text-xl font-semibold text-ink">
                    {t('common.count', { count: report.periodics.length })}
                  </p>
                  <ul className="mt-2 space-y-1">
                    {report.periodics.slice(0, 3).map((row) => (
                      <li
                        key={row.counterparty}
                        className="flex items-center justify-between gap-2 text-xs text-ink-muted"
                      >
                        <span className="truncate">{row.counterparty}</span>
                        <span className="tnum shrink-0">{formatCurrency(row.amount)}</span>
                      </li>
                    ))}
                  </ul>
                </>
              ) : (
                <p className="py-4 text-sm text-ink-subtle">{t('report.periodicEmpty')}</p>
              )}
            </div>

            <div className="rounded-2xl border border-line bg-surface p-4">
              <h2 className="text-sm font-semibold text-ink">{t('report.pendingTitle')}</h2>
              <p className="tnum mt-2 text-xl font-semibold text-ink">
                {t('report.pendingValue', { count: report.pendingCount })}
              </p>
              {report.pendingCount > 0 && (
                <button
                  type="button"
                  onClick={() => navigate('/transactions?pending=1')}
                  className="mt-2 text-xs text-brand hover:underline"
                >
                  {t('report.pendingAction')}
                </button>
              )}
            </div>

            <div className="rounded-2xl border border-line bg-surface p-4">
              <h2 className="text-sm font-semibold text-ink">{t('report.budgetTitle')}</h2>
              {report.budget ? (
                <>
                  <p className="tnum mt-2 text-xl font-semibold text-ink">
                    {t('report.budgetValue', {
                      percent: Math.round(report.budget.percentage * 100),
                    })}
                  </p>
                  <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-canvas">
                    <div
                      className={cn(
                        'h-full rounded-full',
                        report.budget.level === 'exceeded'
                          ? 'bg-expense'
                          : report.budget.level === 'warning'
                            ? 'bg-alert'
                            : 'bg-income',
                      )}
                      style={{
                        width: `${Math.min(100, Math.round(report.budget.percentage * 100))}%`,
                      }}
                    />
                  </div>
                  <p className="tnum mt-1.5 text-xs text-ink-subtle">
                    {formatCurrency(report.budget.spent)} / {formatCurrency(report.budget.limit)}
                  </p>
                </>
              ) : (
                <>
                  <p className="py-4 text-sm text-ink-subtle">{t('report.budgetNoLimit')}</p>
                  <button
                    type="button"
                    onClick={() => navigate('/budget')}
                    className="text-xs text-brand hover:underline"
                  >
                    {t('report.budgetAction')}
                  </button>
                </>
              )}
            </div>
          </section>
        </>
      )}
    </div>
  );
}
