// ============================================================
// BudgetEditor - 总月度预算 + 分类预算的增删改
// ============================================================

import { useEffect, useState } from 'react';
import { ChartPie, Check, Pencil, Plus, Trash, Wallet, X } from 'lucide-react';
import { useBudgetStore } from '@/stores/budget-store';
import { CATEGORIES } from '@/types';
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

  const [showAdd, setShowAdd] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState('');
  const [newLimit, setNewLimit] = useState('');
  const [totalInput, setTotalInput] = useState('');
  const [editingCategory, setEditingCategory] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');

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
    const limit = Number.parseFloat(newLimit);
    if (!selectedCategory || Number.isNaN(limit) || limit <= 0) return;
    setBudget(selectedCategory, limit, month);
    setSelectedCategory('');
    setNewLimit('');
    setShowAdd(false);
  };

  const handleStartEdit = (category: string, currentLimit: number) => {
    setEditingCategory(category);
    setEditValue(String(currentLimit));
  };

  const handleSaveEdit = () => {
    if (!editingCategory) return;
    const limit = Number.parseFloat(editValue);
    if (Number.isNaN(limit) || limit <= 0) return;
    setBudget(editingCategory, limit, month);
    setEditingCategory(null);
    setEditValue('');
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
        <h4 className="mb-3 flex items-center gap-1.5 text-sm font-semibold text-ink">
          <Wallet size={15} className="text-ink-subtle" aria-hidden="true" />
          总月度预算
        </h4>

        {currentTotal > 0 && !totalInput ? (
          <div className="flex flex-wrap items-center gap-3">
            <span className="tnum text-lg font-semibold text-ink">
              {formatCurrency(currentTotal)}
            </span>
            <span className="text-xs text-ink-subtle">/ {month}</span>
            <button
              type="button"
              onClick={() => setTotalInput(String(currentTotal))}
              className="text-xs text-brand hover:underline"
            >
              修改
            </button>
            <button
              type="button"
              onClick={() => setTotalBudget(0, month)}
              className="text-xs text-ink-subtle hover:text-expense"
            >
              清除
            </button>
          </div>
        ) : (
          <div className="flex gap-2">
            <label className="sr-only" htmlFor="budget-total">
              总月度预算金额
            </label>
            <input
              id="budget-total"
              name="totalBudget"
              type="number"
              inputMode="decimal"
              autoComplete="off"
              value={totalInput}
              onChange={(e) => setTotalInput(e.target.value)}
              placeholder={`设置 ${month} 的总预算`}
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
              保存
            </button>
            {currentTotal > 0 && (
              <button
                type="button"
                onClick={() => setTotalInput('')}
                aria-label="取消修改"
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
          <h4 className="flex items-center gap-1.5 text-sm font-semibold text-ink">
            <ChartPie size={15} className="text-ink-subtle" aria-hidden="true" />
            {month} 分类预算
          </h4>
          {!showAdd && availableCategories.length > 0 && (
            <button
              type="button"
              onClick={() => setShowAdd(true)}
              className="flex items-center gap-1 rounded-lg bg-brand px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-brand/90"
            >
              <Plus size={13} aria-hidden="true" />
              添加分类预算
            </button>
          )}
        </div>

        {showAdd && (
          <div className="mb-3 space-y-2 rounded-xl bg-brand-soft p-3">
            <label className="sr-only" htmlFor="budget-category">
              选择分类
            </label>
            <select
              id="budget-category"
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className={INPUT_CLASS}
            >
              <option value="">选择分类</option>
              {availableCategories.map((cat) => (
                <option key={cat.name} value={cat.name}>
                  {cat.name}
                </option>
              ))}
            </select>

            <label className="sr-only" htmlFor="budget-limit">
              预算上限
            </label>
            <input
              id="budget-limit"
              name="monthlyLimit"
              type="number"
              inputMode="decimal"
              autoComplete="off"
              value={newLimit}
              onChange={(e) => setNewLimit(e.target.value)}
              placeholder={`${month} 的预算上限（元）`}
              min="0"
              step="100"
              className={INPUT_CLASS}
            />

            <div className="flex gap-2">
              <button
                type="button"
                onClick={handleAddBudget}
                disabled={!selectedCategory || !newLimit || Number.parseFloat(newLimit) <= 0}
                className="rounded-lg bg-brand px-4 py-1.5 text-sm font-medium text-white transition-colors hover:bg-brand/90 disabled:cursor-not-allowed disabled:opacity-40"
              >
                保存
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowAdd(false);
                  setSelectedCategory('');
                  setNewLimit('');
                }}
                className="rounded-lg bg-surface px-4 py-1.5 text-sm text-ink-muted transition-colors hover:text-ink"
              >
                取消
              </button>
            </div>
          </div>
        )}

        {monthBudgets.length === 0 ? (
          <div className="rounded-xl border border-line bg-surface py-8 text-center">
            <p className="text-sm text-ink-muted">{month} 尚未设置分类预算</p>
            <p className="mt-1 text-xs text-ink-subtle">为常用分类设定上限，超支时自动提醒</p>
          </div>
        ) : (
          <ul className="space-y-2">
            {monthBudgets.map((budget) => {
              const cat = getCategoryInfo(budget.category);
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
                    {budget.category}
                  </span>

                  {isEditing ? (
                    <div className="flex flex-1 gap-2">
                      <label className="sr-only" htmlFor={`edit-${budget.category}`}>
                        {budget.category} 预算上限
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
                        min="0"
                        step="100"
                        className={cn(INPUT_CLASS, 'flex-1')}
                      />
                      <button
                        type="button"
                        onClick={handleSaveEdit}
                        aria-label="保存"
                        className="rounded-lg bg-brand px-2.5 text-white transition-colors hover:bg-brand/90"
                      >
                        <Check size={14} aria-hidden="true" />
                      </button>
                      <button
                        type="button"
                        onClick={() => setEditingCategory(null)}
                        aria-label="取消"
                        className="rounded-lg bg-canvas px-2.5 text-ink-muted transition-colors hover:text-ink"
                      >
                        <X size={14} aria-hidden="true" />
                      </button>
                    </div>
                  ) : (
                    <>
                      <span className="tnum flex-1 text-sm font-medium text-ink">
                        {formatCurrency(budget.monthlyLimit)}
                        <span className="text-xs font-normal text-ink-subtle">/月</span>
                      </span>
                      <div className="flex shrink-0 gap-1">
                        <button
                          type="button"
                          onClick={() => handleStartEdit(budget.category, budget.monthlyLimit)}
                          aria-label={`修改 ${budget.category} 预算`}
                          className="rounded-md p-1.5 text-ink-subtle transition-colors hover:bg-canvas hover:text-brand"
                        >
                          <Pencil size={14} aria-hidden="true" />
                        </button>
                        <button
                          type="button"
                          onClick={() => removeBudget(budget.category, month)}
                          aria-label={`删除 ${budget.category} 预算`}
                          className="rounded-md p-1.5 text-ink-subtle transition-colors hover:bg-expense-soft hover:text-expense"
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
