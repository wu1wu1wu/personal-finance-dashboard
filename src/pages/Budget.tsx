// ============================================================
// 预算页 - 总预算 + 分类预算 + 预算状态
// ============================================================

import { useEffect, useMemo, useState } from 'react';
import { Check, SlidersHorizontal, TriangleAlert, Wallet } from 'lucide-react';
import { useBudgetStore } from '@/stores/budget-store';
import { useTransactionStore } from '@/stores/transaction-store';
import {
  calcBudgetStatus,
  calcTotalBudgetStatus,
  findOverLimitTransactions,
} from '@/core/budget-engine';
import BudgetProgressBar from '@/components/budget/BudgetProgressBar';
import BudgetEditor from '@/components/budget/BudgetEditor';
import { getCurrentMonth, buildMonthOptions } from '@/utils/date';
import { formatCurrency } from '@/utils/format';
import {
  categoryLabel,
  formatDateTimeForLocale,
  formatMonthForLocale,
  formatMonthShortForLocale,
  useLocale,
  useT,
} from '@/i18n';
import { cn } from '@/utils/cn';
import type { BudgetStatus } from '@/types';

export default function Budget() {
  const { budgets, totalBudgets, loaded: budgetLoaded, loadFromStorage: loadBudgets } =
    useBudgetStore();
  const { transactions, loaded: txnLoaded, loadFromStorage: loadTxns } = useTransactionStore();
  const { t } = useT();
  const locale = useLocale();

  const [selectedMonth, setSelectedMonth] = useState(getCurrentMonth());
  const [showEditor, setShowEditor] = useState(false);

  useEffect(() => {
    loadBudgets();
    loadTxns();
  }, [loadBudgets, loadTxns]);

  // 月份选项：最近 6 个月 ∪ 有数据的月份 ∪ 有预算的月份 ∪ 下个月（可以提前给下个月设预算）
  const months = useMemo(
    () =>
      buildMonthOptions(
        transactions.map((t) => t.transactionTime.substring(0, 7)),
        [...budgets.map((b) => b.month), ...Object.keys(totalBudgets)],
      ),
    [transactions, budgets, totalBudgets],
  );

  const budgetStatuses: BudgetStatus[] = useMemo(() => {
    if (!txnLoaded || !budgetLoaded) return [];
    return calcBudgetStatus(transactions, budgets, selectedMonth);
  }, [transactions, budgets, selectedMonth, txnLoaded, budgetLoaded]);

  const totalStatus = useMemo(() => {
    if (!txnLoaded || !budgetLoaded) return null;
    return calcTotalBudgetStatus(transactions, totalBudgets, selectedMonth);
  }, [transactions, totalBudgets, selectedMonth, txnLoaded, budgetLoaded]);

  // 超过「单笔消费上限」的交易
  const overLimit = useMemo(() => {
    if (!txnLoaded || !budgetLoaded) return [];
    return findOverLimitTransactions(transactions, budgets, selectedMonth);
  }, [transactions, budgets, selectedMonth, txnLoaded, budgetLoaded]);

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
        <h1 className="text-xl font-semibold text-ink">{t('budget.heading')}</h1>
        <button
          type="button"
          onClick={() => setShowEditor(!showEditor)}
          aria-expanded={showEditor}
          className={cn(
            'flex min-h-11 items-center gap-1.5 rounded-lg px-3 text-sm font-medium transition-colors',
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
          {showEditor ? t('budget.done') : t('budget.setBudget')}
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
        aria-label={t('budget.monthPickerLabel')}
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

      {isLoading && (
        <p className="py-8 text-center text-sm text-ink-subtle">{t('common.loading')}</p>
      )}

      {!isLoading && !hasAnyBudget && (
        <div className="rounded-2xl border border-line bg-surface py-16 text-center">
          <Wallet size={28} className="mx-auto text-ink-subtle" aria-hidden="true" />
          <p className="mt-3 text-sm font-medium text-ink">{t('budget.emptyTitle')}</p>
          <p className="mt-1 text-sm text-ink-subtle">{t('budget.emptyHint')}</p>
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
                {exceededCount > 0 && (
                  <span>{t('budget.exceededCount', { count: exceededCount })}</span>
                )}
                {exceededCount > 0 && warningCount > 0 && <span>{t('budget.separator')}</span>}
                {warningCount > 0 && (
                  <span>{t('budget.warningCount', { count: warningCount })}</span>
                )}
              </p>
            </div>
          )}

          {/* 总预算 */}
          {totalStatus && (
            <section>
              <h2 className="mb-2 text-sm font-semibold text-ink">{t('budget.totalExecution')}</h2>
              <BudgetProgressBar status={totalStatus} isTotal />
            </section>
          )}

          {/* 分类预算 */}
          {sortedStatuses.length > 0 && (
            <section>
              <h2 className="mb-2 text-sm font-semibold text-ink">{t('budget.categoryExecution')}</h2>
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
              <p className="text-sm text-ink-muted">{t('budget.totalOnlyTitle')}</p>
              <p className="mt-1 text-xs text-ink-subtle">{t('budget.totalOnlyHint')}</p>
            </div>
          )}

          {/* 单笔超限 */}
          {overLimit.length > 0 && (
            <section>
              <h2 className="mb-2 flex items-center gap-1.5 text-sm font-semibold text-ink">
                <TriangleAlert size={15} className="text-alert" aria-hidden="true" />
                {t('budget.overLimitTitle')}
                <span className="text-xs font-normal text-ink-subtle tnum">
                  {t('common.count', { count: overLimit.length })}
                </span>
              </h2>
              <ul className="space-y-2">
                {overLimit.map(({ transaction, limit, over }) => (
                  <li
                    key={transaction.id}
                    className="flex items-center gap-3 rounded-xl border border-line bg-surface p-3"
                  >
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium text-ink">
                        {transaction.counterparty ||
                          transaction.description ||
                          t('budget.unknownTransaction')}
                      </span>
                      <span className="mt-0.5 block truncate text-xs text-ink-subtle">
                        {categoryLabel(locale, transaction.category)} ·{' '}
                        {formatDateTimeForLocale(locale, transaction.transactionTime)} ·{' '}
                        {t('budget.limitAmount', { amount: formatCurrency(limit) })}
                      </span>
                    </span>
                    <span className="shrink-0 text-right">
                      <span className="tnum block whitespace-nowrap text-sm font-semibold text-alert">
                        {formatCurrency(transaction.amount)}
                      </span>
                      <span className="tnum mt-0.5 block whitespace-nowrap text-[11px] text-alert">
                        {t('budget.overAmount', { amount: formatCurrency(over) })}
                      </span>
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </>
      )}
    </div>
  );
}
