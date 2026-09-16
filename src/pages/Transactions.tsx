// ============================================================
// 明细页 - 上传 + 筛选/排序 + 滚动分页 + 详情/删除
// ============================================================

import { useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import UploadZone from '@/components/transactions/UploadZone';
import CategoryTag from '@/components/transactions/CategoryTag';
import TransactionDetailModal from '@/components/transactions/TransactionDetailModal';
import { useTransactionStore } from '@/stores/transaction-store';
import { formatCurrency, formatDateShort } from '@/utils/format';
import { CATEGORIES } from '@/types';
import {
  getAvailableMonths,
  queryTransactions,
  summarizeTransactions,
} from '@/core/transaction-query';
import type { DirectionFilter, SortKey } from '@/core/transaction-query';

/** 每次加载的条数（滚动到底自动加载下一批） */
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

  // 分类筛选（同时支持看板饼图下钻）
  const categoryFilter = searchParams.get('category') ?? '';
  // 待确认收件箱：从看板入口带 ?pending=1 进来
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

  // 条件变化后回到第一批，避免停留在很深的滚动位置
  useEffect(() => {
    setVisibleCount(PAGE_SIZE);
  }, [activeCategory, month, direction, keyword, sort]);

  const visibleTransactions = useMemo(
    () => filteredTransactions.slice(0, visibleCount),
    [filteredTransactions, visibleCount],
  );

  const hasMore = visibleCount < filteredTransactions.length;

  // 滚动到列表底部自动加载下一批
  const sentinelRef = useRef<HTMLDivElement | null>(null);
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

  // 选中的交易直接从 store 派生，这样改了分类或被删除后弹窗会自动同步
  const selectedTxn = useMemo(
    () => (selectedId ? transactions.find((t) => t.id === selectedId) ?? null : null),
    [transactions, selectedId],
  );

  const getCategoryInfo = (name: string) => {
    return CATEGORIES.find((c) => c.name === name) ?? CATEGORIES[CATEGORIES.length - 1];
  };

  const clearFilter = () => {
    setSearchParams({});
  };

  const handleDelete = (id: string) => {
    deleteTransaction(id);
    setPendingDeleteId(null);
  };

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold text-gray-900">交易明细</h1>

      {/* 上传区域 */}
      <UploadZone />

      {/* 筛选与排序 */}
      <div className="bg-white rounded-xl border border-gray-100 p-3 space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          {/* 收支方向 */}
          <div className="flex bg-gray-100 rounded-lg p-0.5">
            {DIRECTION_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                onClick={() => setDirection(opt.value)}
                className={`px-3 py-1.5 text-xs rounded-md transition-colors ${
                  direction === opt.value
                    ? 'bg-white text-gray-900 shadow-sm font-medium'
                    : 'text-gray-500'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>

          {/* 月份 */}
          <select
            value={month}
            onChange={(e) => setMonth(e.target.value)}
            className="px-2 py-1.5 text-xs border border-gray-200 rounded-lg bg-white text-gray-700"
          >
            <option value="">全部月份</option>
            {months.map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </select>

          {/* 排序 */}
          <select
            value={sort}
            onChange={(e) => setSort(e.target.value as SortKey)}
            className="px-2 py-1.5 text-xs border border-gray-200 rounded-lg bg-white text-gray-700"
          >
            {SORT_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>

        <input
          type="search"
          value={keyword}
          onChange={(e) => setKeyword(e.target.value)}
          placeholder="搜索交易对方或商品说明"
          className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
        />
      </div>

      {/* 分类筛选标签（看板下钻 / 待确认收件箱） */}
      {activeCategory && (
        <div className="flex items-center gap-2">
          <span className="text-sm text-gray-500">
            {pendingOnly ? '待确认收件箱：' : '筛选分类：'}
          </span>
          <span className="inline-flex items-center gap-1 px-3 py-1 text-sm bg-blue-50 text-blue-700 rounded-full">
            {getCategoryInfo(activeCategory).icon} {activeCategory}
            <button
              onClick={clearFilter}
              className="ml-1 text-blue-400 hover:text-blue-600"
              title={pendingOnly ? '退出收件箱' : '清除筛选'}
            >
              ✕
            </button>
          </span>
        </div>
      )}

      {/* 统计 */}
      {loaded && filteredTransactions.length > 0 && (
        <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-gray-500">
          <span>共 {summary.count} 条</span>
          <span>支出: {formatCurrency(summary.expense)}</span>
          <span>收入: {formatCurrency(summary.income)}</span>
          {summary.transfer > 0 && <span>转账: {formatCurrency(summary.transfer)}</span>}
        </div>
      )}

      {/* 空状态 */}
      {loaded && filteredTransactions.length === 0 && (
        <div className="text-center py-12 text-gray-400">
          <p className="text-5xl mb-4">{transactions.length === 0 ? '📋' : '🔍'}</p>
          <p className="text-lg">
            {transactions.length === 0 ? '还没有交易记录' : '没有符合条件的交易'}
          </p>
          <p className="text-sm mt-1">
            {transactions.length === 0 ? (
              '上传微信支付账单 CSV 文件开始记账'
            ) : (
              <button
                onClick={() => {
                  setDirection('all');
                  setMonth('');
                  setKeyword('');
                  clearFilter();
                }}
                className="text-blue-500 hover:underline"
              >
                清除全部筛选条件
              </button>
            )}
          </p>
        </div>
      )}

      {/* 交易列表 */}
      {visibleTransactions.length > 0 && (
        <div className="space-y-2">
          {visibleTransactions.map((txn) => {
            const cat = getCategoryInfo(txn.category);
            const isExpense = txn.amount > 0;
            const confirming = pendingDeleteId === txn.id;
            return (
              <div
                key={txn.id}
                onClick={() => setSelectedId(txn.id)}
                className="flex items-center gap-3 rounded-lg border border-gray-100 bg-white p-3 hover:shadow-sm active:bg-gray-50 transition-all cursor-pointer"
              >
                {/* 分类图标 */}
                <div
                  className="flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center text-lg"
                  style={{ backgroundColor: cat.color + '15' }}
                >
                  {cat.icon}
                </div>

                {/* 交易信息 */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-gray-900 truncate">
                      {txn.counterparty || txn.description || '未知交易'}
                    </span>
                    {/* 分类标签自己处理点击，别触发详情弹窗 */}
                    <div onClick={(e) => e.stopPropagation()}>
                      <CategoryTag
                        transactionId={txn.id}
                        category={txn.category}
                        counterparty={txn.counterparty}
                        description={txn.description}
                        source={txn.categorySource}
                        editable
                      />
                    </div>
                  </div>
                  <div className="text-xs text-gray-400 mt-0.5 truncate">
                    {formatDateShort(txn.transactionTime)}
                    {txn.description && ` · ${txn.description.substring(0, 20)}`}
                  </div>
                </div>

                {/* 金额 + 删除 */}
                <div className="flex-shrink-0 flex flex-col items-end gap-1">
                  <span
                    className={`font-mono font-medium ${
                      isExpense ? 'text-red-500' : 'text-green-500'
                    }`}
                  >
                    {isExpense ? '-' : '+'}
                    {formatCurrency(Math.abs(txn.amount))}
                  </span>
                  {confirming ? (
                    <div className="flex gap-1">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDelete(txn.id);
                        }}
                        className="px-2 py-0.5 text-[11px] bg-red-500 text-white rounded"
                      >
                        确认删除
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setPendingDeleteId(null);
                        }}
                        className="px-2 py-0.5 text-[11px] bg-gray-100 text-gray-600 rounded"
                      >
                        取消
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setPendingDeleteId(txn.id);
                      }}
                      className="text-[11px] text-gray-400 hover:text-red-500"
                    >
                      删除
                    </button>
                  )}
                </div>
              </div>
            );
          })}

          {/* 滚动到这里自动加载下一批；按钮作为兜底 */}
          {hasMore && (
            <div ref={sentinelRef} className="text-center py-3">
              <button
                onClick={() => setVisibleCount((count) => count + PAGE_SIZE)}
                className="px-5 py-2 text-sm bg-white border border-gray-200 text-gray-600 rounded-lg hover:bg-gray-50 transition-colors"
              >
                加载更多（还剩 {filteredTransactions.length - visibleCount} 条）
              </button>
            </div>
          )}
          {!hasMore && filteredTransactions.length > PAGE_SIZE && (
            <p className="text-center text-xs text-gray-300 py-3">
              已加载全部 {filteredTransactions.length} 条
            </p>
          )}
        </div>
      )}

      {/* 交易详情弹窗 */}
      {selectedTxn && (
        <TransactionDetailModal txn={selectedTxn} onClose={() => setSelectedId(null)} />
      )}
    </div>
  );
}
