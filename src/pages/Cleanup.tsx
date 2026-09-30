// ============================================================
// 按月份清理 - 选择要删除的月份，而不是一次性清空全部数据
// ============================================================

import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Check, Trash } from 'lucide-react';
import { useTransactionStore } from '@/stores/transaction-store';
import { useBudgetStore } from '@/stores/budget-store';
import UndoBar from '@/components/ui/UndoBar';
import { formatCurrency } from '@/utils/format';
import { isConsumption } from '@/core/transaction-query';
import { cn } from '@/utils/cn';

export default function Cleanup() {
  const navigate = useNavigate();
  const { transactions, loaded, loadFromStorage, deleteByMonths, restoreTrashEntry } =
    useTransactionStore();
  const {
    budgets,
    totalBudgets,
    loaded: budgetLoaded,
    loadFromStorage: loadBudgets,
    removeByMonths,
    restoreFromTrash,
  } = useBudgetStore();

  const [selected, setSelected] = useState<string[]>([]);
  const [confirming, setConfirming] = useState(false);
  const [removedCount, setRemovedCount] = useState<number | null>(null);
  const [undo, setUndo] = useState<{ entryId: string; label: string } | null>(null);

  useEffect(() => {
    void loadFromStorage();
    void loadBudgets();
  }, [loadFromStorage, loadBudgets]);

  // 按月汇总，倒序（新的在前）
  const monthStats = useMemo(() => {
    const map = new Map<string, { count: number; expense: number }>();
    for (const txn of transactions) {
      const key = txn.transactionTime.substring(0, 7);
      if (!/^\d{4}-\d{2}$/.test(key)) continue;
      const entry = map.get(key) ?? { count: 0, expense: 0 };
      entry.count += 1;
      if (isConsumption(txn)) entry.expense += txn.amount;
      map.set(key, entry);
    }
    return [...map.entries()]
      .map(([month, stat]) => ({ month, ...stat }))
      .sort((a, b) => b.month.localeCompare(a.month));
  }, [transactions]);

  const isLoading = !loaded || !budgetLoaded;
  const allSelected = monthStats.length > 0 && selected.length === monthStats.length;

  const toggle = (month: string) => {
    setConfirming(false);
    setSelected((prev) =>
      prev.includes(month) ? prev.filter((m) => m !== month) : [...prev, month],
    );
  };

  const toggleAll = () => {
    setConfirming(false);
    setSelected(allSelected ? [] : monthStats.map((m) => m.month));
  };

  const selectedCount = monthStats
    .filter((m) => selected.includes(m.month))
    .reduce((sum, m) => sum + m.count, 0);

  const handleClean = () => {
    const monthSet = new Set(selected);
    // 先把这次要一起删掉的预算快照下来，撤销时才能一并恢复
    const removedBudgets = budgets.filter((b) => monthSet.has(b.month));
    const removedTotals = Object.fromEntries(
      Object.entries(totalBudgets).filter(([month]) => monthSet.has(month)),
    );
    const label = [...selected].sort().join('、');

    const count = deleteByMonths(selected, {
      label,
      budgets: removedBudgets,
      totalBudgets: removedTotals,
    });
    removeByMonths(selected);
    setRemovedCount(count);
    setSelected([]);
    setConfirming(false);

    // 刚删的这批就是回收站里最新的一条，撤销条据此回滚
    const entryId = useTransactionStore.getState().trash[0]?.id;
    if (entryId && count > 0) {
      setUndo({ entryId, label: `已清理 ${selected.length} 个月，共 ${count} 笔` });
    }
  };

  const handleUndo = () => {
    if (!undo) return;
    const entry = restoreTrashEntry(undo.entryId);
    if (entry) restoreFromTrash(entry);
    setUndo(null);
    setRemovedCount(null);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => navigate('/settings/data')}
          aria-label="返回设置"
          className="-ml-1 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-ink-muted transition-colors hover:bg-canvas hover:text-ink"
        >
          <ArrowLeft size={18} aria-hidden="true" />
        </button>
        <h1 className="text-xl font-semibold text-ink">按月份清理</h1>
      </div>

      <p className="text-sm text-ink-muted">
        勾选要删除的月份，只会清掉这些月份的交易记录和对应月份的预算设置。
        分类规则、其他月份的数据不受影响。
      </p>

      {removedCount !== null && (
        <p
          role="status"
          aria-live="polite"
          className="rounded-xl border border-line bg-income-soft px-3.5 py-3 text-sm text-income"
        >
          已删除 {removedCount} 笔交易。
        </p>
      )}

      {isLoading && <p className="py-10 text-center text-sm text-ink-subtle">加载中…</p>}

      {!isLoading && monthStats.length === 0 && (
        <div className="rounded-2xl border border-line bg-surface py-14 text-center">
          <p className="text-sm font-medium text-ink">没有可清理的数据</p>
          <p className="mt-1 text-sm text-ink-subtle">导入账单后这里会按月列出</p>
        </div>
      )}

      {!isLoading && monthStats.length > 0 && (
        <>
          <div className="flex items-center justify-between">
            <span className="text-sm text-ink-muted tnum">共 {monthStats.length} 个月</span>
            <button
              type="button"
              onClick={toggleAll}
              className="text-sm text-brand hover:underline"
            >
              {allSelected ? '取消全选' : '全选'}
            </button>
          </div>

          <ul className="space-y-2">
            {monthStats.map((item) => {
              const checked = selected.includes(item.month);
              return (
                <li key={item.month}>
                  <button
                    type="button"
                    onClick={() => toggle(item.month)}
                    aria-pressed={checked}
                    className={cn(
                      'flex w-full items-center gap-3 rounded-xl border p-3.5 text-left transition-colors',
                      checked ? 'border-brand/40 bg-brand-soft' : 'border-line bg-surface hover:bg-canvas',
                    )}
                  >
                    <span
                      className={cn(
                        'flex h-6 w-6 shrink-0 items-center justify-center rounded-md border-2 transition-colors',
                        checked ? 'border-brand bg-brand text-white' : 'border-line bg-surface',
                      )}
                      aria-hidden="true"
                    >
                      {checked && <Check size={14} />}
                    </span>

                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-medium text-ink tnum">{item.month}</span>
                      <span className="mt-0.5 block text-xs text-ink-subtle tnum">
                        {item.count} 笔 · 支出 {formatCurrency(item.expense)}
                      </span>
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        </>
      )}

      {/* 底部操作条 */}
      {selected.length > 0 && (
        <div className="fixed inset-x-0 bottom-[calc(4.25rem+env(safe-area-inset-bottom))] z-40 px-4 md:bottom-4">
          <div className="mx-auto max-w-md rounded-xl border border-line bg-surface p-3 shadow-lg">
            {confirming ? (
              <div className="space-y-2.5">
                <p className="text-sm text-ink">
                  将删除 <span className="tnum font-semibold">{selectedCount}</span> 笔交易和
                  {selected.length} 个月的预算设置，此操作不可撤销。
                </p>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={handleClean}
                    className="flex-1 rounded-lg bg-expense py-2.5 text-sm font-medium text-white transition-colors hover:bg-expense/90"
                  >
                    确认清理
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfirming(false)}
                    className="flex-1 rounded-lg bg-canvas py-2.5 text-sm text-ink-muted transition-colors hover:text-ink"
                  >
                    取消
                  </button>
                </div>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setConfirming(true)}
                className="flex w-full items-center justify-center gap-2 rounded-lg bg-expense py-2.5 text-sm font-medium text-white transition-colors hover:bg-expense/90"
              >
                <Trash size={15} aria-hidden="true" />
                清理所选 {selected.length} 个月（共 {selectedCount} 笔）
              </button>
            )}
          </div>
        </div>
      )}

      {undo && (
        <UndoBar label={undo.label} onUndo={handleUndo} onDismiss={() => setUndo(null)} />
      )}
    </div>
  );
}
