// ============================================================
// BudgetEditor - 总月度预算 + 分类预算的增删改
// ============================================================

import { useEffect, useState } from 'react';
import { ChartPie, Check, Pencil, Plus, Trash, Wallet, X } from 'lucide-react';
import { useBudgetStore } from '@/stores/budget-store';
import { CATEGORIES } from '@/types';
import { categoryLabel, formatMonthForLocale, useLocale, useT } from '@/i18n';
import { formatCurrency } from '@/utils/format';
import { cn } from '@/utils/cn';
import CategoryIcon from '@/components/ui/CategoryIcon';

interface BudgetEditorProps {
  /** 当前编辑的月份 "2026-07" */
  month: string;
}

const INPUT_CLASS =
  'w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm text-ink placeholder:text-ink-subtle focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/20';

export default function BudgetEditor({ month }: BudgetEditorProps) {
  const { budgets, getTotalBudget, setBudget, removeBudget, setTotalBudget, loadFromStorage } =
    useBudgetStore();
  const setPerTransactionLimit = useBudgetStore((s) => s.setPerTransactionLimit);
  const { t } = useT();
  const locale = useLocale();
  // 月份在界面上按语言显示（"2026年7月" / "July 2026"），store 里仍然用 "2026-07"
  const monthLabel = formatMonthForLocale(locale, month);

  const [showAdd, setShowAdd] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState('');
  const [newLimit, setNewLimit] = useState('');
  const [newMaxPerTxn, setNewMaxPerTxn] = useState('');
  const [totalInput, setTotalInput] = useState('');
  const [editingCategory, setEditingCategory] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');
  const [editMaxPerTxn, setEditMaxPerTxn] = useState('');

  // 原来在 render 里直接调用 loadFromStorage()，改成 effect 避免渲染期副作用
  useEffect(() => {
    if (!useBudgetStore.getState().loaded) {
      void loadFromStorage();
    }
  }, [loadFromStorage]);

  const currentTotal = getTotalBudget(month);
  const monthBudgets = budgets.filter((b) => b.month === month);
  const budgetedCategories = new Set(monthBudgets.map((b) => b.category));
  const availableCategories = CATEGORIES.filter(
    (c) => c.name !== '待确认' && !budgetedCategories.has(c.name),
  );

  const handleAddBudget = () => {
    const limit = Number.parseFloat(newLimit) || 0;
    const maxPerTxn = Number.parseFloat(newMaxPerTxn) || 0;
    // 月度预算和单笔上限至少填一个
    if (!selectedCategory || (limit <= 0 && maxPerTxn <= 0)) return;
    setBudget(selectedCategory, limit, month);
    setPerTransactionLimit(selectedCategory, maxPerTxn, month);
    setSelectedCategory('');
    setNewLimit('');
    setNewMaxPerTxn('');
    setShowAdd(false);
  };

  const handleStartEdit = (
    category: string,
    currentLimit: number,
    currentMaxPerTxn?: number,
  ) => {
    setEditingCategory(category);
    setEditValue(currentLimit > 0 ? String(currentLimit) : '');
    setEditMaxPerTxn(currentMaxPerTxn && currentMaxPerTxn > 0 ? String(currentMaxPerTxn) : '');
  };

  const handleSaveEdit = () => {
    if (!editingCategory) return;
    const limit = Number.parseFloat(editValue) || 0;
    const maxPerTxn = Number.parseFloat(editMaxPerTxn) || 0;

    if (limit <= 0 && maxPerTxn <= 0) {
      // 两项都清空 = 删除这条预算
      removeBudget(editingCategory, month);
    } else {
      setBudget(editingCategory, limit, month);
      setPerTransactionLimit(editingCategory, maxPerTxn, month);
    }

    setEditingCategory(null);
    setEditValue('');
    setEditMaxPerTxn('');
  };

  const handleSetTotal = () => {
    const amount = Number.parseFloat(totalInput);
    if (Number.isNaN(amount) || amount < 0) return;
    setTotalBudget(amount, month);
    setTotalInput('');
  };

  const getCategoryInfo = (name: string) =>
    CATEGORIES.find((c) => c.name === name) ?? CATEGORIES[CATEGORIES.length - 1];

  return (
    <div className="space-y-5">
      {/* 总月度预算 */}
      <section className="rounded-xl bg-canvas p-4">
        <h2 className="mb-3 flex items-center gap-1.5 text-sm font-semibold text-ink">
          <Wallet size={15} className="text-ink-subtle" aria-hidden="true" />
          {t('budget.totalMonthly')}
        </h2>

        {currentTotal > 0 && !totalInput ? (
          <div className="flex flex-wrap items-center gap-3">
            <span className="tnum text-lg font-semibold text-ink">
              {formatCurrency(currentTotal)}
            </span>
            <span className="text-xs text-ink-subtle">/ {monthLabel}</span>
            <button
              type="button"
              onClick={() => setTotalInput(String(currentTotal))}
              className="text-xs text-brand hover:underline"
            >
              {t('budget.change')}
            </button>
            <button
              type="button"
              onClick={() => setTotalBudget(0, month)}
              className="text-xs text-ink-subtle hover:text-expense"
            >
              {t('common.clear')}
            </button>
          </div>
        ) : (
          <div className="flex gap-2">
            <label className="sr-only" htmlFor="budget-total">
              {t('budget.totalAmountLabel')}
            </label>
            <input
              id="budget-total"
              name="totalBudget"
              type="number"
              inputMode="decimal"
              autoComplete="off"
              value={totalInput}
              onChange={(e) => setTotalInput(e.target.value)}
              placeholder={t('budget.totalPlaceholder', { month: monthLabel })}
              min="0"
              step="100"
              className={cn(INPUT_CLASS, 'flex-1')}
            />
            <button
              type="button"
              onClick={handleSetTotal}
              disabled={!totalInput || Number.parseFloat(totalInput) <= 0}
              className="rounded-lg bg-brand px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-brand/90 disabled:cursor-not-allowed disabled:opacity-40"
            >
              {t('common.save')}
            </button>
            {currentTotal > 0 && (
              <button
                type="button"
                onClick={() => setTotalInput('')}
                aria-label={t('budget.cancelEdit')}
                className="rounded-lg border border-line px-3 py-2 text-sm text-ink-muted transition-colors hover:bg-surface"
              >
                <X size={15} aria-hidden="true" />
              </button>
            )}
          </div>
        )}
      </section>

      {/* 分类预算 */}
      <section>
        <div className="mb-3 flex items-center justify-between gap-3">
          <h2 className="flex items-center gap-1.5 text-sm font-semibold text-ink">
            <ChartPie size={15} className="text-ink-subtle" aria-hidden="true" />
            {t('budget.categoryBudgetForMonth', { month: monthLabel })}
          </h2>
          {!showAdd && availableCategories.length > 0 && (
            <button
              type="button"
              onClick={() => setShowAdd(true)}
              className="flex min-h-11 items-center gap-1 rounded-lg bg-brand px-3 text-xs font-medium text-white transition-colors hover:bg-brand/90"
            >
              <Plus size={13} aria-hidden="true" />
              {t('budget.addCategoryBudget')}
            </button>
          )}
        </div>

        {showAdd && (
          <div className="mb-3 space-y-2 rounded-xl bg-brand-soft p-3">
            <label className="sr-only" htmlFor="budget-category">
              {t('budget.selectCategory')}
            </label>
            <select
              id="budget-category"
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className={INPUT_CLASS}
            >
              <option value="">{t('budget.selectCategory')}</option>
              {availableCategories.map((cat) => (
                <option key={cat.name} value={cat.name}>
                  {categoryLabel(locale, cat.name)}
                </option>
              ))}
            </select>

            <label className="sr-only" htmlFor="budget-limit">
              {t('budget.monthlyLimitLabel')}
            </label>
            <input
              id="budget-limit"
              name="monthlyLimit"
              type="number"
              inputMode="decimal"
              autoComplete="off"
              value={newLimit}
              onChange={(e) => setNewLimit(e.target.value)}
              placeholder={t('budget.monthlyPlaceholder', { month: monthLabel })}
              min="0"
              step="100"
              className={INPUT_CLASS}
            />

            <label className="sr-only" htmlFor="budget-max-per-txn">
              {t('budget.maxPerTxnLabel')}
            </label>
            <input
              id="budget-max-per-txn"
              name="maxPerTransaction"
              type="number"
              inputMode="decimal"
              autoComplete="off"
              value={newMaxPerTxn}
              onChange={(e) => setNewMaxPerTxn(e.target.value)}
              placeholder={t('budget.maxPerTxnPlaceholder')}
              min="0"
              step="50"
              className={INPUT_CLASS}
            />

            <div className="flex gap-2">
              <button
                type="button"
                onClick={handleAddBudget}
                disabled={
                  !selectedCategory ||
                  ((Number.parseFloat(newLimit) || 0) <= 0 &&
                    (Number.parseFloat(newMaxPerTxn) || 0) <= 0)
                }
                className="rounded-lg bg-brand px-4 py-1.5 text-sm font-medium text-white transition-colors hover:bg-brand/90 disabled:cursor-not-allowed disabled:opacity-40"
              >
                {t('common.save')}
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowAdd(false);
                  setSelectedCategory('');
                  setNewLimit('');
                  setNewMaxPerTxn('');
                }}
                className="rounded-lg bg-surface px-4 py-1.5 text-sm text-ink-muted transition-colors hover:text-ink"
              >
                {t('common.cancel')}
              </button>
            </div>
          </div>
        )}

        {monthBudgets.length === 0 ? (
          <div className="rounded-xl border border-line bg-surface py-8 text-center">
            <p className="text-sm text-ink-muted">
              {t('budget.noCategoryBudget', { month: monthLabel })}
            </p>
            <p className="mt-1 text-xs text-ink-subtle">{t('budget.noCategoryBudgetHint')}</p>
          </div>
        ) : (
          <ul className="space-y-2">
            {monthBudgets.map((budget) => {
              const cat = getCategoryInfo(budget.category);
              const catLabel = categoryLabel(locale, budget.category);
              const isEditing = editingCategory === budget.category;

              return (
                <li
                  key={`${budget.category}-${budget.month}`}
                  className="flex items-center gap-3 rounded-xl border border-line bg-surface p-3"
                >
                  <span
                    className="inline-flex shrink-0 items-center gap-1 whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-medium"
                    style={{ backgroundColor: `${cat.color}18`, color: cat.color }}
                  >
                    <CategoryIcon category={budget.category} size={12} />
                    {catLabel}
                  </span>

                  {isEditing ? (
                    <div className="flex flex-1 flex-col gap-2 sm:flex-row">
                      <label className="sr-only" htmlFor={`edit-${budget.category}`}>
                        {t('budget.categoryMonthlyLabel', { category: catLabel })}
                      </label>
                      <input
                        id={`edit-${budget.category}`}
                        name="monthlyLimit"
                        type="number"
                        inputMode="decimal"
                        autoComplete="off"
                        value={editValue}
                        onChange={(e) => setEditValue(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') handleSaveEdit();
                          if (e.key === 'Escape') setEditingCategory(null);
                        }}
                        placeholder={t('budget.monthlyBudgetPlaceholder')}
                        min="0"
                        step="100"
                        className={cn(INPUT_CLASS, 'flex-1')}
                      />

                      <label className="sr-only" htmlFor={`edit-max-${budget.category}`}>
                        {t('budget.categoryMaxPerTxnLabel', { category: catLabel })}
                      </label>
                      <input
                        id={`edit-max-${budget.category}`}
                        name="maxPerTransaction"
                        type="number"
                        inputMode="decimal"
                        autoComplete="off"
                        value={editMaxPerTxn}
                        onChange={(e) => setEditMaxPerTxn(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') handleSaveEdit();
                          if (e.key === 'Escape') setEditingCategory(null);
                        }}
                        placeholder={t('budget.maxPerTxnShortPlaceholder')}
                        min="0"
                        step="50"
                        className={cn(INPUT_CLASS, 'flex-1')}
                      />

                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={handleSaveEdit}
                          aria-label={t('common.save')}
                          className="rounded-lg bg-brand px-2.5 py-2 text-white transition-colors hover:bg-brand/90"
                        >
                          <Check size={14} aria-hidden="true" />
                        </button>
                        <button
                          type="button"
                          onClick={() => setEditingCategory(null)}
                          aria-label={t('common.cancel')}
                          className="rounded-lg bg-canvas px-2.5 text-ink-muted transition-colors hover:text-ink"
                        >
                          <X size={14} aria-hidden="true" />
                        </button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <span className="min-w-0 flex-1">
                        <span className="tnum block truncate text-sm font-medium text-ink">
                          {budget.monthlyLimit > 0
                            ? t('budget.perMonth', {
                                amount: formatCurrency(budget.monthlyLimit),
                              })
                            : t('budget.noMonthlyLimit')}
                        </span>
                        <span className="tnum mt-0.5 block truncate text-[11px] text-ink-subtle">
                          {budget.maxPerTransaction
                            ? t('budget.maxPerTxnValue', {
                                amount: formatCurrency(budget.maxPerTransaction),
                              })
                            : t('budget.noMaxPerTxn')}
                        </span>
                      </span>
                      <div className="flex shrink-0 gap-1">
                        <button
                          type="button"
                          onClick={() =>
                            handleStartEdit(
                              budget.category,
                              budget.monthlyLimit,
                              budget.maxPerTransaction,
                            )
                          }
                          aria-label={t('budget.editBudget', { category: catLabel })}
                          className="flex h-11 w-11 items-center justify-center rounded-lg text-ink-subtle transition-colors hover:bg-canvas hover:text-brand"
                        >
                          <Pencil size={14} aria-hidden="true" />
                        </button>
                        <button
                          type="button"
                          onClick={() => removeBudget(budget.category, month)}
                          aria-label={t('budget.deleteBudget', { category: catLabel })}
                          className="flex h-11 w-11 items-center justify-center rounded-lg text-ink-subtle transition-colors hover:bg-expense-soft hover:text-expense"
                        >
                          <Trash size={14} aria-hidden="true" />
                        </button>
                      </div>
                    </>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
