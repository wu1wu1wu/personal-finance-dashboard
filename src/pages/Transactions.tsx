// ============================================================
// 明细页 - 月份筛选 + 收支/排序/搜索 + 滚动分页 + 详情/删除
//        待确认收件箱支持多选批量归类
// ============================================================

import { useCallback, useDeferredValue, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
import {
  ListChecks,
  ReceiptText,
  RefreshCw,
  Search,
  SearchX,
  SlidersHorizontal,
  X,
} from 'lucide-react';
import TransactionDetailModal from '@/components/transactions/TransactionDetailModal';
import TransactionListItem from '@/components/transactions/TransactionListItem';
import CategoryIcon from '@/components/ui/CategoryIcon';
import MonthPicker from '@/components/ui/MonthPicker';
import UndoBar from '@/components/ui/UndoBar';
import { useTransactionStore } from '@/stores/transaction-store';
import { useClassificationStore } from '@/stores/classification-store';
import { usePerTransactionLimits } from '@/hooks/usePerTransactionLimits';
import { classifyTransaction } from '@/core/classifier';
import {
  DEFAULT_FILTERS,
  countActiveFilters,
  hasAdvancedFilters,
  parseFilterParams,
  mergeFilterParams,
  type TransactionFilterState,
} from '@/core/transaction-filters';
import { categoryLabel, useLocale, useT } from '@/i18n';
import type { MessageKey } from '@/i18n';
import { formatCurrency, parseAmountInput } from '@/utils/format';
import { cn } from '@/utils/cn';
import { CATEGORIES } from '@/types';
import {
  getAvailableMonths,
  queryTransactions,
  summarizeTransactions,
} from '@/core/transaction-query';
import type { DirectionFilter, SortKey } from '@/core/transaction-query';
import { useVirtualList } from '@/hooks/useVirtualList';

/** 超过这个条数才开启列表虚拟化：少于此值全渲染，DOM 压力可忽略 */
const VIRTUALIZE_THRESHOLD = 60;

/** 行高估算值（真实高度由 useVirtualList 量出来后覆盖） */
const ROW_HEIGHT_ESTIMATE = 72;

const DIRECTION_OPTIONS: { value: DirectionFilter; labelKey: MessageKey }[] = [
  { value: 'all', labelKey: 'common.all' },
  { value: 'expense', labelKey: 'common.expense' },
  { value: 'income', labelKey: 'common.income' },
];

const SORT_OPTIONS: { value: SortKey; labelKey: MessageKey }[] = [
  { value: 'time-desc', labelKey: 'transactions.sort.timeDesc' },
  { value: 'time-asc', labelKey: 'transactions.sort.timeAsc' },
  { value: 'amount-desc', labelKey: 'transactions.sort.amountDesc' },
  { value: 'amount-asc', labelKey: 'transactions.sort.amountAsc' },
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
  const { t } = useT();
  const locale = useLocale();

  // 筛选条件全部存在 URL 里：刷新、返回、分享链接都能还原；
  // 看板钻取用的 ?category= / ?pending=1 / ?id= 走同一套解析。
  const filters = useMemo(() => parseFilterParams(searchParams), [searchParams]);
  const activeCategory = filters.pendingOnly ? '待确认' : filters.category;
  const { deepLinkId, month, direction, sort } = filters;

  /** 合并改动写进 URL（默认值不写，保持链接干净） */
  const applyFilters = useCallback(
    (patch: Partial<TransactionFilterState>) => {
      setSearchParams(mergeFilterParams(parseFilterParams(searchParams), patch), {
        replace: true,
      });
    },
    [searchParams, setSearchParams],
  );

  // 文本输入用本地 state 保证打字跟手，停 250ms 再写进 URL
  const [keyword, setKeyword] = useState(filters.keyword);
  const [minAmount, setMinAmount] = useState(filters.minAmount);
  const [maxAmount, setMaxAmount] = useState(filters.maxAmount);

  // URL 变化（返回、粘贴链接）时同步回输入框
  useEffect(() => {
    setKeyword(filters.keyword);
    setMinAmount(filters.minAmount);
    setMaxAmount(filters.maxAmount);
  }, [filters.keyword, filters.minAmount, filters.maxAmount]);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (
        keyword !== filters.keyword ||
        minAmount !== filters.minAmount ||
        maxAmount !== filters.maxAmount
      ) {
        applyFilters({ keyword, minAmount, maxAmount });
      }
    }, 250);
    return () => clearTimeout(timer);
  }, [
    keyword,
    minAmount,
    maxAmount,
    filters.keyword,
    filters.minAmount,
    filters.maxAmount,
    applyFilters,
  ]);

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);

  // 批量归类
  const [batchMode, setBatchMode] = useState(false);
  const [batchIds, setBatchIds] = useState<string[]>([]);
  const [reclassifyHint, setReclassifyHint] = useState<string | null>(null);
  // 删除后的撤销提示（数据同时在设置页的「最近删除」里）
  const [undo, setUndo] = useState<{ entryId: string; label: string } | null>(null);

  const limitOf = usePerTransactionLimits();

  useEffect(() => {
    loadFromStorage();
    void loadRules();
  }, [loadFromStorage, loadRules]);

  const months = useMemo(() => getAvailableMonths(transactions), [transactions]);

  // 输入时先用旧结果渲染，别让每次击键都阻塞主线程（列表可能有上万条）
  const deferredKeyword = useDeferredValue(keyword);

  const filteredTransactions = useMemo(
    () =>
      queryTransactions(transactions, {
        category: activeCategory || undefined,
        month: month || undefined,
        direction,
        keyword: deferredKeyword,
        minAmount: parseAmountInput(minAmount),
        maxAmount: parseAmountInput(maxAmount),
        sort,
      }),
    [transactions, activeCategory, month, direction, deferredKeyword, minAmount, maxAmount, sort],
  );

  const summary = useMemo(
    () => summarizeTransactions(filteredTransactions),
    [filteredTransactions],
  );

  // 条件变化时退出批量模式（列表内容变了，之前勾选的 ids 不再有意义）
  useEffect(() => {
    setBatchMode(false);
    setBatchIds([]);
  }, [activeCategory, month, direction, keyword, sort, minAmount, maxAmount]);

  // 只渲染视口附近的行：上万条记录也不会把 DOM 撑爆
  const list = useVirtualList({
    itemCount: filteredTransactions.length,
    estimatedItemHeight: ROW_HEIGHT_ESTIMATE,
    threshold: VIRTUALIZE_THRESHOLD,
  });

  const visibleTransactions = useMemo(
    () => filteredTransactions.slice(list.startIndex, list.endIndex),
    [filteredTransactions, list.startIndex, list.endIndex],
  );

  // 选中的交易直接读 store，删除后弹窗自动同步
  const selectedTxn = useMemo(() => {
    const id = selectedId ?? deepLinkId;
    return id ? transactions.find((t) => t.id === id) ?? null : null;
  }, [transactions, selectedId, deepLinkId]);

  const closeDetail = () => {
    setSelectedId(null);
    if (deepLinkId) applyFilters({ deepLinkId: null });
  };

  /** 只清掉分类/收件箱筛选，其他条件保留 */
  const clearFilter = () => applyFilters({ category: '', pendingOnly: false });

  // 行组件是 memo 的，传给它的回调必须稳定，否则每次渲染都会击穿 memo
  const handleDelete = useCallback(
    (id: string) => {
      const entryId = deleteTransaction(id);
      setPendingDeleteId(null);
      if (entryId) setUndo({ entryId, label: t('transactions.deleted', { count: 1 }) });
    },
    [deleteTransaction, t],
  );

  const handleUndo = useCallback(() => {
    if (!undo) return;
    useTransactionStore.getState().restoreTrashEntry(undo.entryId);
    setUndo(null);
  }, [undo]);

  const dismissUndo = useCallback(() => setUndo(null), []);

  const cancelDelete = useCallback(() => setPendingDeleteId(null), []);

  const resetAllFilters = () => {
    setKeyword('');
    setMinAmount('');
    setMaxAmount('');
    setSearchParams(new URLSearchParams(), { replace: true });
  };

  const toggleBatchId = useCallback((id: string) => {
    setBatchIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }, []);

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
      setReclassifyHint(t('transactions.reclassify.done', { count: changed }));
      setTimeout(() => setReclassifyHint(null), 4000);
    } else {
      setReclassifyHint(t('transactions.reclassify.empty'));
      setTimeout(() => setReclassifyHint(null), 4000);
    }
  };

  // 高级条件（方向 / 排序 / 金额）默认收起：它们不是天天要调的，
  // 常驻会把半屏让给筛选区；深链带进来时自动展开，别把生效的条件藏起来。
  const advancedActive = hasAdvancedFilters(filters);
  const activeFilterCount = countActiveFilters(filters);
  const [filtersOpen, setFiltersOpen] = useState(advancedActive);

  useEffect(() => {
    if (advancedActive) setFiltersOpen(true);
  }, [advancedActive]);

  const clearAdvancedFilters = () => {
    // 金额输入框是本地 state（打字跟手），这里要一起清，
    // 否则那个 250ms 的防抖回写会把刚清掉的条件又塞回 URL
    setMinAmount('');
    setMaxAmount('');
    applyFilters({
      direction: DEFAULT_FILTERS.direction,
      sort: DEFAULT_FILTERS.sort,
      minAmount: '',
      maxAmount: '',
    });
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-xl font-semibold text-ink">{t('transactions.title')}</h1>
        <div className="flex items-center gap-2">
          {loaded && filteredTransactions.length > 0 && (
            <p className="text-xs text-ink-subtle tnum">
              {t('transactions.summaryCount', { count: summary.count })}
            </p>
          )}
          {filters.pendingOnly && filteredTransactions.length > 0 && (
            <>
              {!batchMode && (
                <button
                  type="button"
                  onClick={handleReclassify}
                  className="flex min-h-11 items-center gap-1 rounded-lg bg-canvas px-2.5 text-xs font-medium text-ink-muted transition-colors hover:text-ink"
                >
                  <RefreshCw size={13} aria-hidden="true" />
                  {t('transactions.reclassify')}
                </button>
              )}
              <button
                type="button"
                onClick={() => (batchMode ? exitBatch() : setBatchMode(true))}
                className={cn(
                  'flex min-h-11 items-center gap-1 rounded-lg px-2.5 text-xs font-medium transition-colors',
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
                {batchMode ? t('common.cancel') : t('transactions.batch.enter')}
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

      {/* 工具条：月份 + 搜索 + 筛选开关（高级条件收在面板里，默认不占地方） */}
      <div className="flex items-center gap-2">
        <MonthPicker
          value={month}
          onChange={(next) => applyFilters({ month: next })}
          monthsWithData={months}
          allowAll
        />

        <div className="relative min-w-0 flex-1">
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
            aria-label={t('transactions.searchLabel')}
            placeholder={t('transactions.searchPlaceholder')}
            className="w-full rounded-lg border border-line bg-surface py-2 pl-9 pr-3 text-sm text-ink placeholder:text-ink-subtle focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/20"
          />
        </div>

        <button
          type="button"
          onClick={() => setFiltersOpen((open) => !open)}
          aria-expanded={filtersOpen}
          aria-label={t('transactions.filter.toggleWithCount', { count: activeFilterCount })}
          className={cn(
            'flex min-h-11 shrink-0 items-center gap-1.5 rounded-lg border px-3 text-sm transition-colors',
            filtersOpen || advancedActive
              ? 'border-brand/40 bg-brand-soft font-medium text-brand'
              : 'border-line bg-surface text-ink-muted hover:bg-canvas hover:text-ink',
          )}
        >
          <SlidersHorizontal size={15} aria-hidden="true" />
          <span className="hidden sm:inline">{t('transactions.filter.toggle')}</span>
          {activeFilterCount > 0 && (
            <span className="tnum flex h-5 min-w-5 items-center justify-center rounded-full bg-brand px-1 text-[11px] font-medium text-white">
              {activeFilterCount}
            </span>
          )}
        </button>
      </div>

      {/* 高级条件：方向 / 排序 / 金额区间 */}
      {filtersOpen && (
        <div
          role="group"
          aria-label={t('transactions.filter.advanced')}
          className="space-y-2 rounded-xl border border-line bg-surface p-3"
        >
          <div className="flex flex-wrap items-center gap-2">
            <div
              role="group"
              aria-label={t('transactions.directionGroup')}
              className="flex rounded-lg bg-canvas p-0.5"
            >
              {DIRECTION_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => applyFilters({ direction: opt.value })}
                  aria-pressed={direction === opt.value}
                  className={cn(
                    'flex min-h-11 items-center rounded-md px-3 text-xs transition-colors',
                    direction === opt.value
                      ? 'bg-surface font-medium text-ink shadow-sm'
                      : 'text-ink-muted hover:text-ink',
                  )}
                >
                  {t(opt.labelKey)}
                </button>
              ))}
            </div>

            <label className="sr-only" htmlFor="txn-sort">
              {t('transactions.sort.label')}
            </label>
            <select
              id="txn-sort"
              value={sort}
              onChange={(e) => applyFilters({ sort: e.target.value as SortKey })}
              className="rounded-lg border border-line bg-surface px-2 py-1.5 text-xs text-ink"
            >
              {SORT_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {t(opt.labelKey)}
                </option>
              ))}
            </select>
          </div>

          {/* 金额区间：按绝对值比较，收入和支出一视同仁 */}
          <div className="flex items-center gap-2">
            <label className="sr-only" htmlFor="txn-min-amount">
              {t('transactions.minAmount')}
            </label>
            <input
              id="txn-min-amount"
              type="number"
              inputMode="decimal"
              min="0"
              step="0.01"
              value={minAmount}
              onChange={(e) => setMinAmount(e.target.value)}
              placeholder={t('transactions.minAmount')}
              className="tnum w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm text-ink placeholder:text-ink-subtle focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/20"
            />
            <span className="shrink-0 text-xs text-ink-subtle">{t('transactions.amountTo')}</span>
            <label className="sr-only" htmlFor="txn-max-amount">
              {t('transactions.maxAmount')}
            </label>
            <input
              id="txn-max-amount"
              type="number"
              inputMode="decimal"
              min="0"
              step="0.01"
              value={maxAmount}
              onChange={(e) => setMaxAmount(e.target.value)}
              placeholder={t('transactions.maxAmount')}
              className="tnum w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm text-ink placeholder:text-ink-subtle focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/20"
            />
            {(minAmount || maxAmount) && (
              <button
                type="button"
                onClick={() => {
                  setMinAmount('');
                  setMaxAmount('');
                }}
                aria-label={t('transactions.clearAmountFilter')}
                className="shrink-0 rounded-lg px-2 py-2 text-ink-subtle hover:text-ink"
              >
                <X size={14} aria-hidden="true" />
              </button>
            )}
          </div>

          <div className="flex items-center justify-between gap-2 pt-0.5">
            <p className="text-[11px] text-ink-subtle">{t('transactions.filter.advancedHint')}</p>
            <button
              type="button"
              onClick={clearAdvancedFilters}
              className="shrink-0 text-xs text-brand hover:underline"
            >
              {t('transactions.filter.clearAdvanced')}
            </button>
          </div>
        </div>
      )}

      {/* 当前筛选条件 */}
      {activeCategory && (
        <div className="flex items-center gap-2">
          <span className="text-sm text-ink-muted">
            {filters.pendingOnly
              ? t('transactions.pendingInboxPrefix')
              : t('transactions.categoryFilterPrefix')}
          </span>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-brand-soft px-3 py-1 text-sm text-brand">
            <CategoryIcon category={activeCategory} size={14} />
            {categoryLabel(locale, activeCategory)}
            <button
              type="button"
              onClick={clearFilter}
              aria-label={
                filters.pendingOnly
                  ? t('transactions.exitInbox')
                  : t('transactions.clearCategoryFilter')
              }
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
          <span>{t('transactions.summary.expense', { amount: formatCurrency(summary.expense) })}</span>
          <span>{t('transactions.summary.income', { amount: formatCurrency(summary.income) })}</span>
          {summary.transfer > 0 && (
            <span>
              {t('transactions.summary.transfer', { amount: formatCurrency(summary.transfer) })}
            </span>
          )}
        </div>
      )}

      {/* 空状态 */}
      {loaded && filteredTransactions.length === 0 && (
        <div className="rounded-2xl border border-line bg-surface py-14 text-center">
          {transactions.length === 0 ? (
            <>
              <ReceiptText size={28} className="mx-auto text-ink-subtle" aria-hidden="true" />
              <p className="mt-3 text-sm font-medium text-ink">{t('transactions.empty.title')}</p>
              <p className="mt-1 text-sm text-ink-subtle">{t('transactions.empty.hint')}</p>
            </>
          ) : (
            <>
              <SearchX size={28} className="mx-auto text-ink-subtle" aria-hidden="true" />
              <p className="mt-3 text-sm font-medium text-ink">
                {t('transactions.emptyFiltered.title')}
              </p>
              <button
                type="button"
                onClick={resetAllFilters}
                className="mt-2 text-sm text-brand hover:underline"
              >
                {t('transactions.emptyFiltered.action')}
              </button>
            </>
          )}
        </div>
      )}

      {/* 交易列表：虚拟化时用上下内边距撑出总高度，只挂载窗口内的行 */}
      {visibleTransactions.length > 0 && (
        <ul
          ref={list.listRef}
          className={cn('space-y-2', batchMode && 'pb-16')}
          style={{
            paddingTop: list.virtualized ? list.offsetY : undefined,
            paddingBottom: list.virtualized ? list.bottomHeight : undefined,
          }}
        >
          {visibleTransactions.map((txn) => (
            <TransactionListItem
              key={txn.id}
              txn={txn}
              batchMode={batchMode}
              checked={batchIds.includes(txn.id)}
              confirmingDelete={pendingDeleteId === txn.id}
              // 单笔上限只对消费生效，转账不参与
              limit={limitOf(txn.category, txn.transactionTime.substring(0, 7))}
              onOpen={setSelectedId}
              onToggleSelect={toggleBatchId}
              onRequestDelete={setPendingDeleteId}
              onConfirmDelete={handleDelete}
              onCancelDelete={cancelDelete}
            />
          ))}
        </ul>
      )}

      {/* 批量归类操作条 */}
      {batchMode && (
        <div className="fixed inset-x-0 bottom-[calc(4.25rem+env(safe-area-inset-bottom))] z-40 px-4 md:bottom-4">
          <div className="mx-auto flex max-w-md items-center gap-3 rounded-xl border border-line bg-surface p-3 shadow-lg">
            <span className="min-w-0 flex-1 text-sm text-ink-muted">
              {t('transactions.batch.selected', { count: batchIds.length })}
            </span>

            <DropdownMenu.Root>
              <DropdownMenu.Trigger asChild>
                <button
                  type="button"
                  disabled={batchIds.length === 0}
                  className="flex min-h-11 items-center gap-1.5 rounded-lg bg-brand px-3 text-sm font-medium text-white transition-colors hover:bg-brand/90 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  {t('transactions.batch.setCategory')}
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
                      {categoryLabel(locale, cat.name)}
                    </DropdownMenu.Item>
                  ))}
                </DropdownMenu.Content>
              </DropdownMenu.Portal>
            </DropdownMenu.Root>
          </div>
        </div>
      )}

      {undo && <UndoBar label={undo.label} onUndo={handleUndo} onDismiss={dismissUndo} />}

      {selectedTxn && <TransactionDetailModal txn={selectedTxn} onClose={closeDetail} />}
    </div>
  );
}
