// ============================================================
// 明细页 - 月份筛选 + 收支/排序/搜索 + 滚动分页 + 详情/删除
//        待确认收件箱支持多选批量归类
// ============================================================

import { useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
import {
  Check,
  ListChecks,
  ReceiptText,
  RefreshCw,
  Search,
  SearchX,
  Trash,
  TriangleAlert,
  X,
} from 'lucide-react';
import CategoryTag from '@/components/transactions/CategoryTag';
import TransactionDetailModal from '@/components/transactions/TransactionDetailModal';
import CategoryIcon from '@/components/ui/CategoryIcon';
import { useTransactionStore } from '@/stores/transaction-store';
import { useClassificationStore } from '@/stores/classification-store';
import { usePerTransactionLimits } from '@/hooks/usePerTransactionLimits';
import { classifyTransaction } from '@/core/classifier';
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
  const {
    transactions,
    loaded,
    loadFromStorage,
    deleteTransaction,
    updateCategoryBatch,
    applyCategories,
  } = useTransactionStore();
  const customRules = useClassificationStore((s) => s.customRules);
  const loadRules = useClassificationStore((s) => s.loadFromStorage);
  const [searchParams, setSearchParams] = useSearchParams();

  // 分类筛选同时支持看板图表钻取
  const categoryFilter = searchParams.get('category') ?? '';
  // 待确认收件箱：从看板 ?pending=1 进入
  const pendingOnly = searchParams.get('pending') === '1';
  // 深链：从主题卡片 ?id=xxx 直接打开某笔详情
  const deepLinkId = searchParams.get('id');
  const activeCategory = pendingOnly ? '待确认' : categoryFilter;

  const [direction, setDirection] = useState<DirectionFilter>('all');
  const [month, setMonth] = useState('');
  const [sort, setSort] = useState<SortKey>('time-desc');
  const [keyword, setKeyword] = useState('');

  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);

  // 批量归类
  const [batchMode, setBatchMode] = useState(false);
  const [batchIds, setBatchIds] = useState<string[]>([]);
  const [reclassifyHint, setReclassifyHint] = useState<string | null>(null);

  const limitOf = usePerTransactionLimits();

  useEffect(() => {
    loadFromStorage();
    void loadRules();
  }, [loadFromStorage, loadRules]);

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

  // 条件变化时回到第一批，并退出批量模式
  useEffect(() => {
    setVisibleCount(PAGE_SIZE);
    setBatchMode(false);
    setBatchIds([]);
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
  const selectedTxn = useMemo(() => {
    const id = selectedId ?? deepLinkId;
    return id ? transactions.find((t) => t.id === id) ?? null : null;
  }, [transactions, selectedId, deepLinkId]);

  const closeDetail = () => {
    setSelectedId(null);
    if (deepLinkId) {
      const next = new URLSearchParams(searchParams);
      next.delete('id');
      setSearchParams(next, { replace: true });
    }
  };

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

  const toggleBatchId = (id: string) => {
    setBatchIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  const exitBatch = () => {
    setBatchMode(false);
    setBatchIds([]);
  };

  const applyBatchCategory = (category: string) => {
    updateCategoryBatch(batchIds, category);
    exitBatch();
  };

  // 补了分类关键词后，把还挂在「待确认」的记录重跑一遍分类
  const handleReclassify = () => {
    const updates = filteredTransactions
      .filter((t) => t.category === '待确认')
      .map((t) => ({ id: t.id, category: classifyTransaction(t, customRules) }))
      .filter((u) => u.category !== '待确认');
    const changed = applyCategories(updates);
    if (changed > 0) {
      setReclassifyHint(`已重新归类 ${changed} 笔`);
      setTimeout(() => setReclassifyHint(null), 4000);
    } else {
      setReclassifyHint('没有可以自动归类的记录');
      setTimeout(() => setReclassifyHint(null), 4000);
    }
  };

  const monthChips = [
    { value: '', label: '全部' },
    ...months.map((m) => ({ value: m, label: `${Number(m.split('-')[1])}月` })),
  ];

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-xl font-semibold text-ink">交易明细</h1>
        <div className="flex items-center gap-2">
          {loaded && filteredTransactions.length > 0 && (
            <p className="text-xs text-ink-subtle tnum">共 {summary.count} 笔</p>
          )}
          {pendingOnly && filteredTransactions.length > 0 && (
            <>
              {!batchMode && (
                <button
                  type="button"
                  onClick={handleReclassify}
                  className="flex items-center gap-1 rounded-lg bg-canvas px-2.5 py-1.5 text-xs font-medium text-ink-muted transition-colors hover:text-ink"
                >
                  <RefreshCw size={13} aria-hidden="true" />
                  重新识别
                </button>
              )}
              <button
                type="button"
                onClick={() => (batchMode ? exitBatch() : setBatchMode(true))}
                className={cn(
                  'flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-medium transition-colors',
                  batchMode
                    ? 'bg-canvas text-ink-muted'
                    : 'bg-brand text-white hover:bg-brand/90',
                )}
              >
                {batchMode ? (
                  <X size={13} aria-hidden="true" />
                ) : (
                  <ListChecks size={13} aria-hidden="true" />
                )}
                {batchMode ? '取消' : '批量归类'}
              </button>
            </>
          )}
        </div>
      </div>

      {reclassifyHint && (
        <p
          role="status"
          aria-live="polite"
          className="rounded-lg bg-income-soft px-3 py-2 text-xs text-income"
        >
          {reclassifyHint}
        </p>
      )}

      {/* 月份筛选：左上角，按月份倒序 */}
      {monthChips.length > 1 && (
        <div
          role="group"
          aria-label="选择月份"
          className="-mx-4 overflow-x-auto px-4 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        >
          <div className="flex w-max gap-1.5">
            {monthChips.map((chip) => {
              const active = month === chip.value;
              return (
                <button
                  key={chip.value || 'all'}
                  type="button"
                  onClick={() => setMonth(chip.value)}
                  aria-pressed={active}
                  aria-label={chip.value ? `${chip.value.replace('-', '年')}月` : '全部月份'}
                  className={cn(
                    'tnum shrink-0 rounded-lg px-3 py-1.5 text-sm transition-colors',
                    active
                      ? 'bg-brand font-medium text-white'
                      : 'bg-surface text-ink-muted hover:text-ink',
                  )}
                >
                  {chip.label}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* 收支方向 + 排序 + 搜索 */}
      <div className="space-y-2 rounded-xl border border-line bg-surface p-3">
        <div className="flex flex-wrap items-center gap-2">
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
                到「设置」导入微信账单，或点底部加号手动记一笔
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
        <ul className={cn('space-y-2', batchMode && 'pb-16')}>
          {visibleTransactions.map((txn) => {
            const cat = CATEGORIES.find((c) => c.name === txn.category) ?? CATEGORIES[CATEGORIES.length - 1];
            const isExpense = txn.amount > 0;
            const isTransfer = txn.category === TRANSFER_CATEGORY;
            const confirming = pendingDeleteId === txn.id;
            const checked = batchIds.includes(txn.id);
            const displayName = txn.counterparty || txn.description || '未知交易';
            // 单笔上限只对消费生效，转账不参与
            const limit = limitOf(txn.category, txn.transactionTime.substring(0, 7));
            const overLimit =
              limit !== undefined && isExpense && !isTransfer && txn.amount > limit;

            return (
              <li
                key={txn.id}
                className={cn(
                  'relative flex items-center gap-3 rounded-xl border bg-surface p-3 transition-colors',
                  checked ? 'border-brand/40 bg-brand-soft' : 'border-line hover:bg-canvas',
                )}
              >
                {/* 批量模式下整行可点切换选中；否则打开详情 */}
                <button
                  type="button"
                  onClick={() => (batchMode ? toggleBatchId(txn.id) : setSelectedId(txn.id))}
                  aria-label={batchMode ? `选择 ${displayName}` : `查看 ${displayName} 的详情`}
                  aria-pressed={batchMode ? checked : undefined}
                  className="absolute inset-0 z-0 rounded-xl"
                />

                {batchMode ? (
                  <span
                    className={cn(
                      'pointer-events-none relative z-10 flex h-7 w-7 shrink-0 items-center justify-center rounded-md border-2 transition-colors',
                      checked ? 'border-brand bg-brand text-white' : 'border-line bg-surface',
                    )}
                    aria-hidden="true"
                  >
                    {checked && <Check size={15} />}
                  </span>
                ) : (
                  <span
                    className="pointer-events-none relative z-10 flex h-10 w-10 shrink-0 items-center justify-center rounded-full"
                    style={{ backgroundColor: `${cat.color}18`, color: cat.color }}
                  >
                    <CategoryIcon category={txn.category} size={18} />
                  </span>
                )}

                {/* 对方 + 时间 + 分类标签 */}
                <div className="pointer-events-none relative z-10 min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-ink">
                    {txn.theme ? `${txn.theme} · ${displayName}` : displayName}
                  </p>
                  <div className="mt-0.5 flex items-center gap-1.5">
                    {!batchMode && (
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
                    )}
                    <span className="min-w-0 truncate text-xs text-ink-subtle">
                      {formatDateShort(txn.transactionTime)}
                      {txn.description && ` · ${txn.description.substring(0, 20)}`}
                    </span>
                  </div>
                  {overLimit && (
                    <p className="mt-1 flex items-center gap-1 text-[11px] text-alert">
                      <TriangleAlert size={11} aria-hidden="true" />
                      超过单笔上限 {formatCurrency(limit)}
                    </p>
                  )}
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

                  {!batchMode &&
                    (confirming ? (
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
                    ))}
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

      {/* 批量归类操作条 */}
      {batchMode && (
        <div className="fixed inset-x-0 bottom-[calc(4.25rem+env(safe-area-inset-bottom))] z-40 px-4">
          <div className="mx-auto flex max-w-md items-center gap-3 rounded-xl border border-line bg-surface p-3 shadow-lg">
            <span className="min-w-0 flex-1 text-sm text-ink-muted">
              已选 <span className="tnum font-semibold text-ink">{batchIds.length}</span> 笔
            </span>

            <DropdownMenu.Root>
              <DropdownMenu.Trigger asChild>
                <button
                  type="button"
                  disabled={batchIds.length === 0}
                  className="flex items-center gap-1.5 rounded-lg bg-brand px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-brand/90 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  设为分类
                  <span aria-hidden="true">▾</span>
                </button>
              </DropdownMenu.Trigger>
              <DropdownMenu.Portal>
                <DropdownMenu.Content
                  align="end"
                  side="top"
                  sideOffset={6}
                  collisionPadding={12}
                  className="pfd-fade-in z-50 max-h-[var(--radix-dropdown-menu-content-available-height)] min-w-[10rem] overflow-y-auto rounded-lg border border-line bg-surface py-1 shadow-lg"
                  style={{ overscrollBehavior: 'contain' }}
                >
                  {CATEGORIES.filter((c) => c.name !== '待确认').map((cat) => (
                    <DropdownMenu.Item
                      key={cat.name}
                      onSelect={() => applyBatchCategory(cat.name)}
                      className="flex cursor-pointer items-center gap-2 px-3 py-2 text-sm text-ink outline-none data-[highlighted]:bg-canvas"
                    >
                      <CategoryIcon category={cat.name} size={14} />
                      {cat.name}
                    </DropdownMenu.Item>
                  ))}
                </DropdownMenu.Content>
              </DropdownMenu.Portal>
            </DropdownMenu.Root>
          </div>
        </div>
      )}

      {selectedTxn && <TransactionDetailModal txn={selectedTxn} onClose={closeDetail} />}
    </div>
  );
}
