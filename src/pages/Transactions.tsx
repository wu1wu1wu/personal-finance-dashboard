// ============================================================
// 明细页 - 上传 + 筛选/排序 + 滚动分页 + 详情/删除
// ============================================================

import { useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { ReceiptText, SearchX, Search, Trash, X } from 'lucide-react';
import UploadZone from '@/components/transactions/UploadZone';
import CategoryTag from '@/components/transactions/CategoryTag';
import TransactionDetailModal from '@/components/transactions/TransactionDetailModal';
import CategoryIcon from '@/components/ui/CategoryIcon';
import { useTransactionStore } from '@/stores/transaction-store';
import { formatCurrency, formatDateShort } from '@/utils/format';
import { cn } from '@/utils/cn';
import { CATEGORIES } from '@/types';
import {
  getAvailableMonths,
  queryTransactions,
  summarizeTransactions,
  TRANSFER_CATEGORY,
} from '@/core/transaction-query';
import type { DirectionFilter, SortKey } from '@/core/transaction-query';

/** 每次加载的条数，滚动到底自动续下一批 */
const PAGE_SIZE = 20;

const DIRECTION_OPTIONS: { value: DirectionFilter; label: string }[] = [
  { value: 'all', label: '全部' },
  { value: 'expense', label: '支出' },
  { value: 'income', label: '收入' },
];

const SORT_OPTIONS: { value: SortKey; label: string }[] = [
  { value: 'time-desc', label: '时间：新 → 旧' },
  { value: 'time-asc', label: '时间：旧 → 新' },
  { value: 'amount-desc', label: '金额：大 → 小' },
  { value: 'amount-asc', label: '金额：小 → 大' },
];

export default function Transactions() {
  const { transactions, loaded, loadFromStorage, deleteTransaction } = useTransactionStore();
  const [searchParams, setSearchParams] = useSearchParams();

  // 分类筛选同时支持看板图表钻取
  const categoryFilter = searchParams.get('category') ?? '';
  // 待确认收件箱：从看板 ?pending=1 进入
  const pendingOnly = searchParams.get('pending') === '1';
  const activeCategory = pendingOnly ? '待确认' : categoryFilter;

  const [direction, setDirection] = useState<DirectionFilter>('all');
  const [month, setMonth] = useState('');
  const [sort, setSort] = useState<SortKey>('time-desc');
  const [keyword, setKeyword] = useState('');

  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);

  useEffect(() => {
    loadFromStorage();
  }, [loadFromStorage]);

  const months = useMemo(() => getAvailableMonths(transactions), [transactions]);

  const filteredTransactions = useMemo(
    () =>
      queryTransactions(transactions, {
        category: activeCategory || undefined,
        month: month || undefined,
        direction,
        keyword,
        sort,
      }),
    [transactions, activeCategory, month, direction, keyword, sort],
  );

  const summary = useMemo(
    () => summarizeTransactions(filteredTransactions),
    [filteredTransactions],
  );

  // 条件变化时回到第一批，避免停在列表中间
  useEffect(() => {
    setVisibleCount(PAGE_SIZE);
  }, [activeCategory, month, direction, keyword, sort]);

  const visibleTransactions = useMemo(
    () => filteredTransactions.slice(0, visibleCount),
    [filteredTransactions, visibleCount],
  );

  const hasMore = visibleCount < filteredTransactions.length;

  // 滚动到列表底部自动加载下一批
  const sentinelRef = useRef<HTMLLIElement | null>(null);
  useEffect(() => {
    const el = sentinelRef.current;
    if (!el || !hasMore) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) {
          setVisibleCount((count) => count + PAGE_SIZE);
        }
      },
      { rootMargin: '240px' },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [hasMore, filteredTransactions.length]);

  // 选中的交易直接读 store，删除后弹窗自动同步
  const selectedTxn = useMemo(
    () => (selectedId ? transactions.find((t) => t.id === selectedId) ?? null : null),
    [transactions, selectedId],
  );

  const clearFilter = () => setSearchParams({});

  const handleDelete = (id: string) => {
    deleteTransaction(id);
    setPendingDeleteId(null);
  };

  const resetAllFilters = () => {
    setDirection('all');
    setMonth('');
    setKeyword('');
    clearFilter();
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-xl font-semibold text-ink">交易明细</h1>
        {loaded && filteredTransactions.length > 0 && (
          <p className="text-xs text-ink-subtle tnum">共 {summary.count} 笔</p>
        )}
      </div>

      <UploadZone />

      {/* 筛选与排序 */}
      <div className="space-y-2 rounded-xl border border-line bg-surface p-3">
        <div className="flex flex-wrap items-center gap-2">
          {/* 收支方向 */}
          <div role="group" aria-label="收支方向" className="flex rounded-lg bg-canvas p-0.5">
            {DIRECTION_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => setDirection(opt.value)}
                aria-pressed={direction === opt.value}
                className={cn(
                  'rounded-md px-3 py-1.5 text-xs transition-colors',
                  direction === opt.value
                    ? 'bg-surface font-medium text-ink shadow-sm'
                    : 'text-ink-muted hover:text-ink',
                )}
              >
                {opt.label}
              </button>
            ))}
          </div>

          <label className="sr-only" htmlFor="txn-month">
            月份
          </label>
          <select
            id="txn-month"
            value={month}
            onChange={(e) => setMonth(e.target.value)}
            className="rounded-lg border border-line bg-surface px-2 py-1.5 text-xs text-ink"
          >
            <option value="">全部月份</option>
            {months.map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </select>

          <label className="sr-only" htmlFor="txn-sort">
            排序方式
          </label>
          <select
            id="txn-sort"
            value={sort}
            onChange={(e) => setSort(e.target.value as SortKey)}
            className="rounded-lg border border-line bg-surface px-2 py-1.5 text-xs text-ink"
          >
            {SORT_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>

        <div className="relative">
          <Search
            size={15}
            aria-hidden="true"
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-subtle"
          />
          <input
            type="search"
            name="keyword"
            autoComplete="off"
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
            aria-label="搜索交易对方或商品说明"
            placeholder="搜索交易对方或商品说明…"
            className="w-full rounded-lg border border-line bg-surface py-2 pl-9 pr-3 text-sm text-ink placeholder:text-ink-subtle focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/20"
          />
        </div>
      </div>

      {/* 当前筛选条件 */}
      {activeCategory && (
        <div className="flex items-center gap-2">
          <span className="text-sm text-ink-muted">
            {pendingOnly ? '待确认收件箱：' : '筛选分类：'}
          </span>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-brand-soft px-3 py-1 text-sm text-brand">
            <CategoryIcon category={activeCategory} size={14} />
            {activeCategory}
            <button
              type="button"
              onClick={clearFilter}
              aria-label={pendingOnly ? '退出收件箱' : '清除分类筛选'}
              className="ml-0.5 text-brand/70 hover:text-brand"
            >
              <X size={13} aria-hidden="true" />
            </button>
          </span>
        </div>
      )}

      {/* 汇总 */}
      {loaded && filteredTransactions.length > 0 && (
        <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-ink-muted tnum">
          <span>支出: {formatCurrency(summary.expense)}</span>
          <span>收入: {formatCurrency(summary.income)}</span>
          {summary.transfer > 0 && <span>转账: {formatCurrency(summary.transfer)}</span>}
        </div>
      )}

      {/* 空状态 */}
      {loaded && filteredTransactions.length === 0 && (
        <div className="rounded-2xl border border-line bg-surface py-14 text-center">
          {transactions.length === 0 ? (
            <>
              <ReceiptText size={28} className="mx-auto text-ink-subtle" aria-hidden="true" />
              <p className="mt-3 text-sm font-medium text-ink">还没有交易记录</p>
              <p className="mt-1 text-sm text-ink-subtle">
                上传微信支付账单 CSV 文件，或在看板点加号手动记一笔
              </p>
            </>
          ) : (
            <>
              <SearchX size={28} className="mx-auto text-ink-subtle" aria-hidden="true" />
              <p className="mt-3 text-sm font-medium text-ink">没有符合筛选的交易</p>
              <button
                type="button"
                onClick={resetAllFilters}
                className="mt-2 text-sm text-brand hover:underline"
              >
                清除全部筛选条件
              </button>
            </>
          )}
        </div>
      )}

      {/* 交易列表 */}
      {visibleTransactions.length > 0 && (
        <ul className="space-y-2">
          {visibleTransactions.map((txn) => {
            const cat = CATEGORIES.find((c) => c.name === txn.category) ?? CATEGORIES[CATEGORIES.length - 1];
            const isExpense = txn.amount > 0;
            const isTransfer = txn.category === TRANSFER_CATEGORY;
            const confirming = pendingDeleteId === txn.id;
            const displayName = txn.counterparty || txn.description || '未知交易';

            return (
              <li
                key={txn.id}
                className="relative flex items-center gap-3 rounded-xl border border-line bg-surface p-3 transition-colors hover:bg-canvas focus-within:bg-canvas"
              >
                {/* 整行可点：用覆盖式按钮，避免把 CategoryTag 嵌进 button 里 */}
                <button
                  type="button"
                  onClick={() => setSelectedId(txn.id)}
                  aria-label={`查看 ${displayName} 的详情`}
                  className="absolute inset-0 z-0 rounded-xl"
                />

                {/* 分类图标 */}
                <span
                  className="pointer-events-none relative z-10 flex h-10 w-10 shrink-0 items-center justify-center rounded-full"
                  style={{ backgroundColor: `${cat.color}18`, color: cat.color }}
                >
                  <CategoryIcon category={txn.category} size={18} />
                </span>

                {/* 对方 + 时间 + 分类标签 */}
                <div className="pointer-events-none relative z-10 min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-ink">{displayName}</p>
                  <div className="mt-0.5 flex items-center gap-1.5">
                    <div className="pointer-events-auto shrink-0">
                      <CategoryTag
                        transactionId={txn.id}
                        category={txn.category}
                        counterparty={txn.counterparty}
                        description={txn.description}
                        source={txn.categorySource}
                        editable
                      />
                    </div>
                    <span className="min-w-0 truncate text-xs text-ink-subtle">
                      {formatDateShort(txn.transactionTime)}
                      {txn.description && ` · ${txn.description.substring(0, 20)}`}
                    </span>
                  </div>
                </div>

                {/* 金额 + 删除 */}
                <div className="relative z-10 flex shrink-0 flex-col items-end gap-1">
                  <span
                    className={cn(
                      'tnum whitespace-nowrap text-sm font-semibold',
                      isTransfer ? 'text-ink-muted' : isExpense ? 'text-expense' : 'text-income',
                    )}
                  >
                    {isTransfer ? '' : isExpense ? '-' : '+'}
                    {formatCurrency(Math.abs(txn.amount))}
                  </span>

                  {confirming ? (
                    <div className="flex gap-1">
                      <button
                        type="button"
                        onClick={() => handleDelete(txn.id)}
                        className="rounded px-2 py-1 text-[11px] font-medium bg-expense text-white hover:bg-expense/90"
                      >
                        确认删除
                      </button>
                      <button
                        type="button"
                        onClick={() => setPendingDeleteId(null)}
                        className="rounded px-2 py-1 text-[11px] bg-canvas text-ink-muted hover:text-ink"
                      >
                        取消
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setPendingDeleteId(txn.id)}
                      aria-label={`删除 ${displayName}`}
                      className="flex items-center gap-1 rounded-md px-1.5 py-1 text-[11px] text-ink-subtle transition-colors hover:bg-expense-soft hover:text-expense"
                    >
                      <Trash size={12} aria-hidden="true" />
                      删除
                    </button>
                  )}
                </div>
              </li>
            );
          })}

          {/* 兜底按钮：自动加载之外也给一个明确出口 */}
          {hasMore && (
            <li ref={sentinelRef} className="py-3 text-center">
              <button
                type="button"
                onClick={() => setVisibleCount((count) => count + PAGE_SIZE)}
                className="rounded-lg border border-line bg-surface px-5 py-2 text-sm text-ink-muted transition-colors hover:bg-canvas"
              >
                加载更多（还剩 {filteredTransactions.length - visibleCount} 条）
              </button>
            </li>
          )}
          {!hasMore && filteredTransactions.length > PAGE_SIZE && (
            <li className="py-3 text-center text-xs text-ink-subtle tnum">
              已加载全部 {filteredTransactions.length} 条
            </li>
          )}
        </ul>
      )}

      {selectedTxn && (
        <TransactionDetailModal txn={selectedTxn} onClose={() => setSelectedId(null)} />
      )}
    </div>
  );
}
