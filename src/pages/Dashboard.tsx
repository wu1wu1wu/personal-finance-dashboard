// ============================================================
// 看板 - 概览优先
//
// 第一屏必须回答三个问题：本月花了多少、花在哪、最近几笔是什么。
// 封面图单独放一个视图，不占用概览的首屏空间。
// ============================================================

import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChartPie, ChevronDown, FileText, Images, TriangleAlert } from 'lucide-react';
import { useTransactionStore } from '@/stores/transaction-store';
import {
  calcMonthlyTrend,
  calcCategoryBreakdown,
  calcDailySpend,
} from '@/core/dashboard-engine';
import {
  getPeriodicTransactions,
  calcPeriodicBreakdown,
} from '@/core/periodic-engine';
import {
  buildRecurringReminders,
  summarizeRecurringReminders,
} from '@/core/recurring-reminder';
import { getCurrentMonth, getTodayLocal, buildMonthOptions } from '@/utils/date';
import { useBudgetStore } from '@/stores/budget-store';
import { useRecurringStore } from '@/stores/recurring-store';
import {
  categoryLabel,
  useT,
  useLocale,
  formatMonthForLocale,
  formatMonthShortForLocale,
} from '@/i18n';
import type { MessageKey } from '@/i18n';
import { formatAmount, formatCurrency } from '@/utils/format';
import { isConsumption } from '@/core/transaction-query';
import { cn } from '@/utils/cn';
import MonthlyTrendChart from '@/components/dashboard/MonthlyTrendChart';
import CategoryPieChart from '@/components/dashboard/CategoryPieChart';
import DailyBarChart from '@/components/dashboard/DailyBarChart';
import PeriodicList from '@/components/periodic/PeriodicList';
import PeriodicBreakdownChart from '@/components/periodic/PeriodicBreakdownChart';
import RecurringReminders from '@/components/periodic/RecurringReminders';
import TransactionCard from '@/components/transactions/TransactionCard';
import TransactionRow from '@/components/transactions/TransactionRow';

type ViewMode = 'overview' | 'album';

/** 概览里「最近交易」显示条数 */
const RECENT_COUNT = 5;

const VIEW_OPTIONS: { value: ViewMode; labelKey: MessageKey; icon: typeof ChartPie }[] = [
  { value: 'overview', labelKey: 'dashboard.viewOverview', icon: ChartPie },
  { value: 'album', labelKey: 'dashboard.viewAlbum', icon: Images },
];

export default function Dashboard() {
  const { transactions, loaded, loadFromStorage, togglePeriodicBatch, setTheme } =
    useTransactionStore();
  const { totalBudgets, loadFromStorage: loadBudgets } = useBudgetStore();
  const {
    ignored,
    loadFromStorage: loadIgnored,
    ignore: ignoreRecurring,
    restore: restoreRecurring,
  } = useRecurringStore();
  const navigate = useNavigate();
  const { t } = useT();
  const locale = useLocale();

  const [selectedMonth, setSelectedMonth] = useState(getCurrentMonth());
  const [viewMode, setViewMode] = useState<ViewMode>('overview');

  useEffect(() => {
    loadFromStorage();
    void loadBudgets();
    void loadIgnored();
  }, [loadFromStorage, loadBudgets, loadIgnored]);

  // 月份选项：最近 6 个月 ∪ 有数据的月份 ∪ 有预算的月份 ∪ 下个月，倒序（最新在前）
  const months = useMemo(
    () =>
      buildMonthOptions(
        transactions.map((t) => t.transactionTime.substring(0, 7)),
        Object.keys(totalBudgets),
      ),
    [transactions, totalBudgets],
  );

  const monthTxns = useMemo(
    () =>
      transactions
        .filter((t) => t.transactionTime.startsWith(selectedMonth))
        .sort((a, b) => b.transactionTime.localeCompare(a.transactionTime)),
    [transactions, selectedMonth],
  );

  // 本月口径：转账不计入支出
  const monthStats = useMemo(() => {
    const expense = monthTxns.filter(isConsumption).reduce((s, t) => s + t.amount, 0);
    const income = monthTxns
      .filter((t) => t.amount < 0)
      .reduce((s, t) => s + Math.abs(t.amount), 0);
    const transfer = monthTxns
      .filter((t) => t.amount > 0 && !isConsumption(t))
      .reduce((s, t) => s + t.amount, 0);
    return { expense, income, balance: income - expense, transfer, count: monthTxns.length };
  }, [monthTxns]);

  const pendingCount = useMemo(
    () => transactions.filter((t) => t.category === '待确认').length,
    [transactions],
  );

  const categoryData = useMemo(
    () => calcCategoryBreakdown(transactions, selectedMonth),
    [transactions, selectedMonth],
  );

  // 图表里的扇区名要跟着语言走，但点击钻取仍用 category 原值（见 chart-options 的 buildPieOption）
  const categoryChartData = useMemo(
    () =>
      categoryData.map((point) => ({
        ...point,
        displayName: categoryLabel(locale, point.category),
      })),
    [categoryData, locale],
  );
  const trendData = useMemo(() => calcMonthlyTrend(transactions), [transactions]);
  const dailyData = useMemo(
    () => calcDailySpend(transactions, selectedMonth),
    [transactions, selectedMonth],
  );
  const periodicData = useMemo(() => getPeriodicTransactions(transactions), [transactions]);
  const periodicBreakdown = useMemo(
    () => calcPeriodicBreakdown(transactions, selectedMonth),
    [transactions, selectedMonth],
  );

  // 周期扣款提醒：忽略名单里的商户不参与（也不进「每月固定支出」的合计）
  const recurringReminders = useMemo(
    () =>
      buildRecurringReminders({
        transactions,
        today: getTodayLocal(),
        ignored,
      }),
    [transactions, ignored],
  );
  const recurringSummary = useMemo(
    () => summarizeRecurringReminders(recurringReminders),
    [recurringReminders],
  );

  const recentTxns = monthTxns.slice(0, RECENT_COUNT);
  // 主题视图只陈列设过主题或配过图的账单
  const themedTxns = useMemo(
    () => monthTxns.filter((t) => t.theme || t.coverImage),
    [monthTxns],
  );

  const handleUnmarkPeriodic = (counterparty: string, amount: number) => {
    // 一次批量写回：逐条 toggle 会触发 N 次全量序列化
    const ids = transactions
      .filter(
        (txn) =>
          txn.isPeriodic &&
          txn.counterparty === counterparty &&
          Math.abs(txn.amount - amount) <= 1,
      )
      .map((txn) => txn.id);
    togglePeriodicBatch(ids);
  };

  const isLoading = !loaded;
  const isEmpty = !isLoading && transactions.length === 0;

  return (
    <div className="space-y-4">
      {/* 标题栏 */}
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-xl font-semibold text-ink">{t('dashboard.title')}</h1>

        <div
          role="group"
          aria-label={t('dashboard.viewSwitcherLabel')}
          className="flex rounded-lg bg-canvas p-0.5"
        >
          {VIEW_OPTIONS.map((opt) => {
            const Icon = opt.icon;
            const active = viewMode === opt.value;
            return (
              <button
                key={opt.value}
                type="button"
                onClick={() => setViewMode(opt.value)}
                aria-pressed={active}
                className={cn(
                  'flex min-h-11 items-center gap-1.5 rounded-md px-3 text-xs font-medium transition-colors',
                  active ? 'bg-surface text-ink shadow-sm' : 'text-ink-muted hover:text-ink',
                )}
              >
                <Icon size={14} aria-hidden="true" />
                {t(opt.labelKey)}
              </button>
            );
          })}
        </div>
      </div>

      {/* 月份切换：横向滚动，避免窄屏折行 */}
      {months.length > 0 && (
        <div
          role="group"
          aria-label={t('dashboard.monthPickerLabel')}
          className="-mx-4 overflow-x-auto px-4 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        >
          <div className="flex w-max gap-1.5">
            {months.map((m) => {
              const active = m === selectedMonth;
              return (
                <button
                  key={m}
                  type="button"
                  onClick={() => setSelectedMonth(m)}
                  aria-pressed={active}
                  aria-label={formatMonthForLocale(locale, m)}
                  className={cn(
                    'tnum flex min-h-11 shrink-0 items-center rounded-lg px-3 text-sm transition-colors',
                    active
                      ? 'bg-brand font-medium text-white'
                      : 'bg-surface text-ink-muted hover:text-ink',
                  )}
                >
                  {formatMonthShortForLocale(locale, m)}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {isLoading && (
        <p className="py-12 text-center text-sm text-ink-subtle">{t('common.loading')}</p>
      )}

      {isEmpty && (
        <div className="rounded-2xl border border-line bg-surface py-16 text-center">
          <p className="text-base font-medium text-ink">{t('dashboard.emptyTitle')}</p>
          <p className="mt-1 text-sm text-ink-subtle">{t('dashboard.emptyHint')}</p>
        </div>
      )}

      {!isLoading && !isEmpty && viewMode === 'overview' && (
        <>
          {/* 待确认提醒 */}
          {pendingCount > 0 && (
            <button
              type="button"
              onClick={() => navigate('/transactions?pending=1')}
              className="flex w-full items-center gap-2.5 rounded-xl border border-alert-soft bg-alert-soft px-3.5 py-3 text-left transition-colors hover:brightness-[0.98]"
            >
              <TriangleAlert size={17} className="shrink-0 text-alert" aria-hidden="true" />
              <span className="min-w-0 flex-1 text-sm text-alert">
                <span className="tnum font-semibold">{pendingCount}</span>{' '}
                {t('dashboard.pendingSuffix', { count: pendingCount })}
              </span>
              <span className="shrink-0 text-xs text-alert/80">{t('dashboard.pendingAction')}</span>
            </button>
          )}

          {/* 本月收支：整个页面的主角 */}
          <section className="rounded-2xl border border-line bg-surface p-5">
            <p className="text-xs text-ink-subtle">{t('dashboard.monthExpense')}</p>
            <p className="mt-1 flex items-baseline gap-1">
              <span className="tnum text-[32px] font-semibold leading-none text-expense">
                {formatAmount(monthStats.expense)}
              </span>
              <span className="text-sm text-expense">{t('common.yuan')}</span>
            </p>

            <div className="mt-4 grid grid-cols-2 gap-3 border-t border-line pt-3.5">
              <div>
                <p className="text-xs text-ink-subtle">{t('common.income')}</p>
                <p className="tnum mt-0.5 text-sm font-medium text-income">
                  {formatCurrency(monthStats.income)}
                </p>
              </div>
              <div>
                <p className="text-xs text-ink-subtle">{t('common.balance')}</p>
                <p
                  className={cn(
                    'tnum mt-0.5 text-sm font-medium',
                    monthStats.balance >= 0 ? 'text-ink' : 'text-ink-muted',
                  )}
                >
                  {monthStats.balance >= 0 ? '' : '-'}
                  {formatCurrency(Math.abs(monthStats.balance))}
                </p>
              </div>
            </div>

            <p className="mt-3 border-t border-line pt-3 text-[11px] text-ink-subtle">
              {t('dashboard.monthTxnCount', { count: monthStats.count })}
              {monthStats.transfer > 0 &&
                ` · ${t('dashboard.transferNote', {
                  amount: formatCurrency(monthStats.transfer),
                })}`}
            </p>
          </section>

          {/* 周期扣款提醒：一个认识的商户都没有时整块不出现 */}
          {(recurringReminders.length > 0 || ignored.length > 0) && (
            <RecurringReminders
              reminders={recurringReminders}
              summary={recurringSummary}
              ignored={ignored}
              onIgnore={ignoreRecurring}
              onRestore={restoreRecurring}
            />
          )}

          {/* 月度报告入口：带上当前选中的月份 */}
          <button
            type="button"
            onClick={() => navigate(`/report?month=${selectedMonth}`)}
            className="flex min-h-11 w-full items-center justify-between gap-2 rounded-xl border border-line bg-surface px-4 py-2.5 text-sm text-ink transition-colors hover:bg-canvas"
          >
            <span className="flex items-center gap-1.5">
              <FileText size={15} className="text-ink-subtle" aria-hidden="true" />
              {t('dashboard.reportLink')}
            </span>
            <span className="tnum text-xs text-ink-subtle">
              {formatMonthForLocale(locale, selectedMonth)}
            </span>
          </button>

          <CategoryPieChart
            data={categoryChartData}
            onCategoryClick={(category) =>
              navigate(`/transactions?category=${encodeURIComponent(category)}`)
            }
          />

          {/* 最近交易 */}
          {recentTxns.length > 0 && (
            <section className="rounded-2xl border border-line bg-surface p-2">
              <div className="flex items-center justify-between px-2 pb-1 pt-2">
                <h2 className="text-sm font-semibold text-ink">{t('dashboard.recentTitle')}</h2>
                <button
                  type="button"
                  onClick={() => navigate('/transactions')}
                  className="text-xs text-brand hover:underline"
                >
                  {t('dashboard.viewAll')}
                </button>
              </div>
              <ul>
                {recentTxns.map((txn) => (
                  <TransactionRow
                    key={txn.id}
                    txn={txn}
                    onClick={() => navigate(`/transactions?id=${encodeURIComponent(txn.id)}`)}
                  />
                ))}
              </ul>
            </section>
          )}

          <MonthlyTrendChart data={trendData} />

          {/* 次要分析默认收起，别让概览变成一张长报表 */}
          <details className="group rounded-2xl border border-line bg-surface">
            <summary className="flex cursor-pointer list-none items-center justify-between px-4 py-3.5 text-sm font-medium text-ink [&::-webkit-details-marker]:hidden">
              {t('dashboard.moreAnalysis')}
              <ChevronDown
                size={16}
                className="text-ink-subtle transition-transform group-open:rotate-180"
                aria-hidden="true"
              />
            </summary>
            <div className="space-y-4 border-t border-line p-4">
              <DailyBarChart data={dailyData} />
              <PeriodicBreakdownChart data={periodicBreakdown} />
              <PeriodicList data={periodicData} onTogglePeriodic={handleUnmarkPeriodic} />
            </div>
          </details>
        </>
      )}

      {/* ====== 主题视图 ====== */}
      {!isLoading && !isEmpty && viewMode === 'album' && (
        <>
          {themedTxns.length > 0 ? (
            <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {themedTxns.map((txn) => (
                <TransactionCard
                  key={txn.id}
                  txn={txn}
                  onClick={() => navigate(`/transactions?id=${encodeURIComponent(txn.id)}`)}
                  onClearTheme={() => setTheme(txn.id, '')}
                />
              ))}
            </ul>
          ) : (
            <div className="rounded-2xl border border-line bg-surface px-4 py-14 text-center">
              <Images size={28} className="mx-auto text-ink-subtle" aria-hidden="true" />
              <p className="mt-3 text-sm font-medium text-ink">{t('dashboard.albumEmptyTitle')}</p>
              <p className="mt-1 text-sm text-ink-subtle">{t('dashboard.albumEmptyHint')}</p>
            </div>
          )}
        </>
      )}

    </div>
  );
}
