// ============================================================
// 预算页 - 总预算 + 分类预算 + 预算状态
// ============================================================

import { useEffect, useMemo, useState } from 'react';
import { Check, SlidersHorizontal, TriangleAlert, Wallet } from 'lucide-react';
import { useBudgetStore } from '@/stores/budget-store';
import { useTransactionStore } from '@/stores/transaction-store';
import { calcBudgetStatus, calcTotalBudgetStatus } from '@/core/budget-engine';
import BudgetProgressBar from '@/components/budget/BudgetProgressBar';
import BudgetEditor from '@/components/budget/BudgetEditor';
import { getCurrentMonth, getRecentMonths } from '@/utils/date';
import { cn } from '@/utils/cn';
import type { BudgetStatus } from '@/types';

export default function Budget() {
  const { budgets, totalBudgets, loaded: budgetLoaded, loadFromStorage: loadBudgets } =
    useBudgetStore();
  const { transactions, loaded: txnLoaded, loadFromStorage: loadTxns } = useTransactionStore();

  const [selectedMonth, setSelectedMonth] = useState(getCurrentMonth());
  const [showEditor, setShowEditor] = useState(false);

  useEffect(() => {
    loadBudgets();
    loadTxns();
  }, [loadBudgets, loadTxns]);

  const months = useMemo(() => getRecentMonths(6), []);

  const budgetStatuses: BudgetStatus[] = useMemo(() => {
    if (!txnLoaded || !budgetLoaded) return [];
    return calcBudgetStatus(transactions, budgets, selectedMonth);
  }, [transactions, budgets, selectedMonth, txnLoaded, budgetLoaded]);

  const totalStatus = useMemo(() => {
    if (!txnLoaded || !budgetLoaded) return null;
    return calcTotalBudgetStatus(transactions, totalBudgets, selectedMonth);
  }, [transactions, totalBudgets, selectedMonth, txnLoaded, budgetLoaded]);

  const warningCount = budgetStatuses.filter((s) => s.level === 'warning').length;
  const exceededCount = budgetStatuses.filter((s) => s.level === 'exceeded').length;

  const isLoading = !txnLoaded || !budgetLoaded;
  const hasAnyBudget = budgets.length > 0 || Object.keys(totalBudgets).length > 0;

  const sortedStatuses = useMemo(
    () =>
      [...budgetStatuses].sort((a, b) => {
        const order = { exceeded: 0, warning: 1, normal: 2 };
        return order[a.level] - order[b.level];
      }),
    [budgetStatuses],
  );

  const noBudgetThisMonth =
    budgets.filter((b) => b.month === selectedMonth).length === 0 &&
    (totalBudgets[selectedMonth] ?? totalBudgets[''] ?? 0) > 0;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-xl font-semibold text-ink">预算管理</h1>
        <button
          type="button"
          onClick={() => setShowEditor(!showEditor)}
          aria-expanded={showEditor}
          className={cn(
            'flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors',
            showEditor
              ? 'bg-canvas text-ink-muted hover:text-ink'
              : 'bg-brand text-white hover:bg-brand/90',
          )}
        >
          {showEditor ? (
            <Check size={15} aria-hidden="true" />
          ) : (
            <SlidersHorizontal size={15} aria-hidden="true" />
          )}
          {showEditor ? '完成' : '设置预算'}
        </button>
      </div>

      {/* 预算编辑面板 */}
      {showEditor && (
        <div className="rounded-2xl border border-line bg-surface p-4">
          <BudgetEditor month={selectedMonth} />
        </div>
      )}

      {/* 月份切换：横向滚动，窄屏不折行 */}
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

      {isLoading && <p className="py-8 text-center text-sm text-ink-subtle">加载中…</p>}

      {!isLoading && !hasAnyBudget && (
        <div className="rounded-2xl border border-line bg-surface py-16 text-center">
          <Wallet size={28} className="mx-auto text-ink-subtle" aria-hidden="true" />
          <p className="mt-3 text-sm font-medium text-ink">还未设置预算</p>
          <p className="mt-1 text-sm text-ink-subtle">
            点右上角「设置预算」为这个月设定上限
          </p>
        </div>
      )}

      {!isLoading && hasAnyBudget && (
        <>
          {/* 预警汇总 */}
          {(warningCount > 0 || exceededCount > 0) && (
            <div
              className={cn(
                'flex items-center gap-2.5 rounded-xl border px-3.5 py-3',
                exceededCount > 0
                  ? 'border-expense-soft bg-expense-soft'
                  : 'border-alert-soft bg-alert-soft',
              )}
            >
              <TriangleAlert
                size={17}
                aria-hidden="true"
                className={cn('shrink-0', exceededCount > 0 ? 'text-expense' : 'text-alert')}
              />
              <p
                className={cn(
                  'text-sm font-medium',
                  exceededCount > 0 ? 'text-expense' : 'text-alert',
                )}
              >
                {exceededCount > 0 && <span>{exceededCount} 个分类已超支</span>}
                {exceededCount > 0 && warningCount > 0 && <span>，</span>}
                {warningCount > 0 && <span>{warningCount} 个分类接近预算</span>}
              </p>
            </div>
          )}

          {/* 总预算 */}
          {totalStatus && (
            <section>
              <h2 className="mb-2 text-sm font-semibold text-ink">总预算执行</h2>
              <BudgetProgressBar status={totalStatus} isTotal />
            </section>
          )}

          {/* 分类预算 */}
          {sortedStatuses.length > 0 && (
            <section>
              <h2 className="mb-2 text-sm font-semibold text-ink">分类预算执行</h2>
              <div className="space-y-2">
                {sortedStatuses.map((status) => (
                  <BudgetProgressBar key={status.category} status={status} />
                ))}
              </div>
            </section>
          )}

          {/* 只设了总预算、没有分类预算时的提示 */}
          {noBudgetThisMonth && sortedStatuses.length === 0 && (
            <div className="rounded-2xl border border-line bg-surface px-4 py-8 text-center">
              <p className="text-sm text-ink-muted">已设总预算，但未配置分类预算</p>
              <p className="mt-1 text-xs text-ink-subtle">
                为常用分类单独设定预算，可以更细地控制支出
              </p>
            </div>
          )}
        </>
      )}
    </div>
  );
}
