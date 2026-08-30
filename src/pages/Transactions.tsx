import { useEffect, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import UploadZone from '@/components/transactions/UploadZone';
import CategoryTag from '@/components/transactions/CategoryTag';
import { useTransactionStore } from '@/stores/transaction-store';
import { formatCurrency, formatDateShort } from '@/utils/format';
import { CATEGORIES } from '@/types';

export default function Transactions() {
  const { transactions, loaded, loadFromStorage } = useTransactionStore();
  const [searchParams, setSearchParams] = useSearchParams();

  // 从URL参数读取分类筛选
  const categoryFilter = searchParams.get('category') ?? undefined;

  useEffect(() => {
    loadFromStorage();
  }, [loadFromStorage]);

  // 按分类筛选（支持看板饼图下钻）
  const filteredTransactions = useMemo(() => {
    if (!categoryFilter) return transactions;
    return transactions.filter((t) => t.category === categoryFilter);
  }, [transactions, categoryFilter]);

  const getCategoryInfo = (name: string) => {
    return CATEGORIES.find((c) => c.name === name) ?? CATEGORIES[CATEGORIES.length - 1];
  };

  // 清除分类筛选
  const clearFilter = () => {
    setSearchParams({});
  };

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">交易明细</h1>

      {/* 上传区域 */}
      <UploadZone />

      {/* 分类筛选标签（从看板下钻时显示） */}
      {categoryFilter && (
        <div className="flex items-center gap-2">
          <span className="text-sm text-gray-500">筛选分类：</span>
          <span className="inline-flex items-center gap-1 px-3 py-1 text-sm bg-blue-50 text-blue-700 rounded-full">
            {getCategoryInfo(categoryFilter).icon} {categoryFilter}
            <button
              onClick={clearFilter}
              className="ml-1 text-blue-400 hover:text-blue-600"
              title="清除筛选"
            >
              ✕
            </button>
          </span>
          <span className="text-xs text-gray-400">
            {filteredTransactions.length} 条记录
          </span>
        </div>
      )}

      {/* 交易统计 */}
      {loaded && transactions.length > 0 && (
        <div className="flex gap-4 text-sm text-gray-500">
          <span>共 {filteredTransactions.length} 条记录</span>
          <span>
            支出: {formatCurrency(filteredTransactions.filter((t) => t.amount > 0).reduce((s, t) => s + t.amount, 0))}
          </span>
          <span>
            收入: {formatCurrency(Math.abs(filteredTransactions.filter((t) => t.amount < 0).reduce((s, t) => s + t.amount, 0)))}
          </span>
        </div>
      )}

      {/* 空状态 */}
      {loaded && filteredTransactions.length === 0 && (
        <div className="text-center py-12 text-gray-400">
          <p className="text-5xl mb-4">{categoryFilter ? '🔍' : '📋'}</p>
          <p className="text-lg">
            {categoryFilter ? `没有"${categoryFilter}"分类的交易` : '还没有交易记录'}
          </p>
          <p className="text-sm mt-1">
            {categoryFilter ? (
              <button onClick={clearFilter} className="text-blue-500 hover:underline">
                清除筛选，查看全部交易
              </button>
            ) : (
              '上传微信支付账单CSV文件开始记账'
            )}
          </p>
        </div>
      )}

      {/* 交易列表 */}
      {filteredTransactions.length > 0 && (
        <div className="space-y-2">
          {filteredTransactions.slice(0, 50).map((txn) => {
            const cat = getCategoryInfo(txn.category);
            const isExpense = txn.amount > 0;
            return (
              <div
                key={txn.id}
                className="flex items-center gap-3 rounded-lg border border-gray-100 bg-white p-3 hover:shadow-sm transition-shadow"
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
                    <CategoryTag
                      transactionId={txn.id}
                      category={txn.category}
                      counterparty={txn.counterparty}
                      description={txn.description}
                      source={txn.categorySource}
                      editable
                    />
                  </div>
                  <div className="text-xs text-gray-400 mt-0.5">
                    {formatDateShort(txn.transactionTime)}
                    {txn.description && ` · ${txn.description.substring(0, 20)}`}
                  </div>
                </div>

                {/* 金额 */}
                <div className={`flex-shrink-0 font-mono font-medium ${isExpense ? 'text-red-500' : 'text-green-500'}`}>
                  {isExpense ? '-' : '+'}{formatCurrency(Math.abs(txn.amount))}
                </div>
              </div>
            );
          })}

          {filteredTransactions.length > 50 && (
            <p className="text-center text-sm text-gray-400 py-2">
              显示前 50 条，共 {filteredTransactions.length} 条
            </p>
          )}
        </div>
      )}
    </div>
  );
}