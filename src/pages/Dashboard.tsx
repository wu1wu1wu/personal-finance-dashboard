// ============================================================
// 看板 - 概览优先
//
// 第一屏必须回答三个问题：本月花了多少、花在哪、最近几笔是什么。
// 封面图单独放一个视图，不占用概览的首屏空间。
// ============================================================

import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChartPie, ChevronDown, Images, TriangleAlert } from 'lucide-react';
import { useTransactionStore } from '@/stores/transaction-store';
import {
  calcMonthlyTrend,
  calcCategoryBreakdown,
  calcDailySpend,
} from '@/core/dashboard-engine';
import {
  detectPeriodicTransactions,
  calcPeriodicBreakdown,
} from '@/core/periodic-engine';
import { getCurrentMonth, getRecentMonths } from '@/utils/date';
import { formatAmount, formatCurrency } from '@/utils/format';
import { isConsumption } from '@/core/transaction-query';
import { cn } from '@/utils/cn';
import MonthlyTrendChart from '@/components/dashboard/MonthlyTrendChart';
import CategoryPieChart from '@/components/dashboard/CategoryPieChart';
import DailyBarChart from '@/components/dashboard/DailyBarChart';
import PeriodicList from '@/components/periodic/PeriodicList';
import PeriodicBreakdownChart from '@/components/periodic/PeriodicBreakdownChart';
import TransactionCard from '@/components/transactions/TransactionCard';
import TransactionRow from '@/components/transactions/TransactionRow';

type ViewMode = 'overview' | 'album';

/** 概览里「最近交易」显示条数 */
const RECENT_COUNT = 5;

const VIEW_OPTIONS: { value: ViewMode; label: string; icon: typeof ChartPie }[] = [
  { value: 'overview', label: '概览', icon: ChartPie },
  { value: 'album', label: '封面', icon: Images },
];

export default function Dashboard() {
  const { transactions, loaded, loadFromStorage, togglePeriodic } = useTransactionStore();
  const navigate = useNavigate();

  const [selectedMonth, setSelectedMonth] = useState(getCurrentMonth());
  const [viewMode, setViewMode] = useState<ViewMode>('overview');

  useEffect(() => {
    loadFromStorage();
  }, [loadFromStorage]);

  // 最近 6 个月 + 有数据的月份
  const months = useMemo(() => {
    const recent = getRecentMonths(6);
    const dataMonths = new Set(transactions.map((t) => t.transactionTime.substring(0, 7)));
    recent.forEach((m) => dataMonths.add(m));
    return [...dataMonths].filter(Boolean).sort();
  }, [transactions]);

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
  const trendData = useMemo(() => calcMonthlyTrend(transactions), [transactions]);
  const dailyData = useMemo(
    () => calcDailySpend(transactions, selectedMonth),
    [transactions, selectedMonth],
  );
  const periodicData = useMemo(() => detectPeriodicTransactions(transactions), [transactions]);
  const periodicBreakdown = useMemo(
    () => calcPeriodicBreakdown(transactions, selectedMonth),
    [transactions, selectedMonth],
  );

  const recentTxns = monthTxns.slice(0, RECENT_COUNT);
  const coveredTxns = useMemo(() => monthTxns.filter((t) => t.coverImage), [monthTxns]);

  const handleUnmarkPeriodic = (counterparty: string, amount: number) => {
    for (const txn of transactions) {
      if (
        txn.isPeriodic &&
        txn.counterparty === counterparty &&
        Math.abs(txn.amount - amount) <= 1
      ) {
        togglePeriodic(txn.id);
      }
    }
  };

  const isLoading = !loaded;
  const isEmpty = !isLoading && transactions.length === 0;

  return (
    <div className="space-y-4">
      {/* 标题栏 */}
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-xl font-semibold text-ink">看板</h1>

        <div
          role="group"
          aria-label="看板视图"
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
                  'flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors',
                  active ? 'bg-surface text-ink shadow-sm' : 'text-ink-muted hover:text-ink',
                )}
              >
                <Icon size={14} aria-hidden="true" />
                {opt.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* 月份切换：横向滚动，避免窄屏折行 */}
      {months.length > 0 && (
        <div
          role="group"
          aria-label="选择月份"
          className="-mx-4 overflow-x-auto px-4 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        >
          <div className="flex w-max gap-1.5">
            {months.map((m) => {
              const active = m === selectedMonth;
              const [, month] = m.split('-');
              return (
                <button
                  key={m}
                  type="button"
                  onClick={() => setSelectedMonth(m)}
                  aria-pressed={active}
                  aria-label={`${m.replace('-', '年')}月`}
                  className={cn(
                    'tnum shrink-0 rounded-lg px-3 py-1.5 text-sm transition-colors',
                    active
                      ? 'bg-brand font-medium text-white'
                      : 'bg-surface text-ink-muted hover:text-ink',
                  )}
                >
                  {Number(month)}月
                </button>
              );
            })}
          </div>
        </div>
      )}

      {isLoading && <p className="py-12 text-center text-sm text-ink-subtle">加载中…</p>}

      {isEmpty && (
        <div className="rounded-2xl border border-line bg-surface py-16 text-center">
          <p className="text-base font-medium text-ink">还没有记账记录</p>
          <p className="mt-1 text-sm text-ink-subtle">
            点右下角加号手动记一笔，或到「设置」导入微信账单
          </p>
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
                <span className="tnum font-semibold">{pendingCount}</span> 笔交易待确认分类
              </span>
              <span className="shrink-0 text-xs text-alert/80">去处理</span>
            </button>
          )}

          {/* 本月收支：整个页面的主角 */}
          <section className="rounded-2xl border border-line bg-surface p-5">
            <p className="text-xs text-ink-subtle">本月支出</p>
            <p className="mt-1 flex items-baseline gap-1">
              <span className="tnum text-[32px] font-semibold leading-none text-expense">
                {formatAmount(monthStats.expense)}
              </span>
              <span className="text-sm text-expense">元</span>
            </p>

            <div className="mt-4 grid grid-cols-2 gap-3 border-t border-line pt-3.5">
              <div>
                <p className="text-xs text-ink-subtle">收入</p>
                <p className="tnum mt-0.5 text-sm font-medium text-income">
                  {formatCurrency(monthStats.income)}
                </p>
              </div>
              <div>
                <p className="text-xs text-ink-subtle">结余</p>
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
              共 {monthStats.count} 笔
              {monthStats.transfer > 0 && ` · 另有转账 ${formatCurrency(monthStats.transfer)}，不计入支出`}
            </p>
          </section>

          <CategoryPieChart
            data={categoryData}
            onCategoryClick={(category) =>
              navigate(`/transactions?category=${encodeURIComponent(category)}`)
            }
          />

          {/* 最近交易 */}
          {recentTxns.length > 0 && (
            <section className="rounded-2xl border border-line bg-surface p-2">
              <div className="flex items-center justify-between px-2 pb-1 pt-2">
                <h2 className="text-sm font-semibold text-ink">最近交易</h2>
                <button
                  type="button"
                  onClick={() => navigate('/transactions')}
                  className="text-xs text-brand hover:underline"
                >
                  查看全部
                </button>
              </div>
              <ul>
                {recentTxns.map((txn) => (
                  <TransactionRow
                    key={txn.id}
                    txn={txn}
                    onClick={() => navigate(`/transactions?category=${encodeURIComponent(txn.category)}`)}
                  />
                ))}
              </ul>
            </section>
          )}

          <MonthlyTrendChart data={trendData} />

          {/* 次要分析默认收起，别让概览变成一张长报表 */}
          <details className="group rounded-2xl border border-line bg-surface">
            <summary className="flex cursor-pointer list-none items-center justify-between px-4 py-3.5 text-sm font-medium text-ink [&::-webkit-details-marker]:hidden">
              更多分析
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

      {/* ====== 封面视图 ====== */}
      {!isLoading && !isEmpty && viewMode === 'album' && (
        <>
          {coveredTxns.length > 0 ? (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
              {coveredTxns.map((txn) => (
                <TransactionCard
                  key={txn.id}
                  txn={txn}
                  onClick={() =>
                    navigate(`/transactions?category=${encodeURIComponent(txn.category)}`)
                  }
                />
              ))}
            </div>
          ) : (
            <div className="rounded-2xl border border-line bg-surface py-16 text-center">
              <Images size={28} className="mx-auto text-ink-subtle" aria-hidden="true" />
              <p className="mt-3 text-sm font-medium text-ink">本月还没有账单封面</p>
              <p className="mt-1 text-sm text-ink-subtle">
                在「明细」里点开任意一笔记录即可添加图片
              </p>
            </div>
          )}
        </>
      )}

    </div>
  );
}
