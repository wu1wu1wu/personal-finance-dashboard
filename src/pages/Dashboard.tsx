// ============================================================
// 首页 - 交易卡片列表 + 分类筛选 + 分页 + 图表视图切换
// ============================================================

import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTransactionStore } from '@/stores/transaction-store';
import {
  calcMonthlyTrend,
  calcCategoryBreakdown,
  calcDailySpend,
  calcDashboardMetrics,
} from '@/core/dashboard-engine';
import {
  detectPeriodicTransactions,
  calcPeriodicBreakdown,
} from '@/core/periodic-engine';
import { getCurrentMonth, getRecentMonths } from '@/utils/date';
import { formatCurrency } from '@/utils/format';
import { CATEGORIES } from '@/types';
import DashboardStats from '@/components/dashboard/DashboardStats';
import MonthlyTrendChart from '@/components/dashboard/MonthlyTrendChart';
import CategoryPieChart from '@/components/dashboard/CategoryPieChart';
import DailyBarChart from '@/components/dashboard/DailyBarChart';
import PeriodicList from '@/components/periodic/PeriodicList';
import PeriodicBreakdownChart from '@/components/periodic/PeriodicBreakdownChart';
import TransactionCard from '@/components/transactions/TransactionCard';
import AddTransactionModal from '@/components/transactions/AddTransactionModal';

type ViewMode = 'card' | 'chart';
const PAGE_SIZE = 10;

export default function Dashboard() {
  const {
    transactions,
    loaded,
    loadFromStorage,
    togglePeriodic,
  } = useTransactionStore();
  const navigate = useNavigate();

  const [selectedMonth, setSelectedMonth] = useState(getCurrentMonth());
  const [viewMode, setViewMode] = useState<ViewMode>('card');
  const [categoryFilter, setCategoryFilter] = useState(''); // 空=全部
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const [showAddModal, setShowAddModal] = useState(false);

  // 加载数据
  useEffect(() => {
    loadFromStorage();
  }, [loadFromStorage]);

  // 切换月份/分类时重置分页
  useEffect(() => {
    setVisibleCount(PAGE_SIZE);
  }, [selectedMonth, categoryFilter]);

  // 动态月份列表：最近6个月 + 所有有交易的月份
  const months = useMemo(() => {
    const recent = getRecentMonths(6);
    const dataMonths = new Set(transactions.map((t) => t.transactionTime.substring(0, 7)));
    recent.forEach((m) => dataMonths.add(m));
    return [...dataMonths].sort();
  }, [transactions]);

  // ===== 卡片视图数据 =====
  const monthTxns = useMemo(() => {
    return transactions
      .filter((t) => t.transactionTime.startsWith(selectedMonth))
      .sort((a, b) => b.transactionTime.localeCompare(a.transactionTime));
  }, [transactions, selectedMonth]);

  // 按分类筛选
  const filteredTransactions = useMemo(() => {
    if (!categoryFilter) return monthTxns;
    return monthTxns.filter((t) => t.category === categoryFilter);
  }, [monthTxns, categoryFilter]);

  // 分页
  const visibleTransactions = useMemo(() => {
    return filteredTransactions.slice(0, visibleCount);
  }, [filteredTransactions, visibleCount]);

  const hasMore = visibleCount < filteredTransactions.length;

  // 当月支出/收入统计（按筛选后）
  const monthStats = useMemo(() => {
    const expense = filteredTransactions.filter((t) => t.amount > 0).reduce((s, t) => s + t.amount, 0);
    const income = filteredTransactions.filter((t) => t.amount < 0).reduce((s, t) => s + Math.abs(t.amount), 0);
    return { expense, income, count: filteredTransactions.length };
  }, [filteredTransactions]);

  // ===== 图表视图数据 =====
  const trendData = useMemo(() => calcMonthlyTrend(transactions), [transactions]);
  const categoryData = useMemo(
    () => calcCategoryBreakdown(transactions, selectedMonth),
    [transactions, selectedMonth],
  );
  const dailyData = useMemo(
    () => calcDailySpend(transactions, selectedMonth),
    [transactions, selectedMonth],
  );
  const metrics = useMemo(
    () => calcDashboardMetrics(transactions, selectedMonth),
    [transactions, selectedMonth],
  );
  const periodicData = useMemo(
    () => detectPeriodicTransactions(transactions),
    [transactions],
  );
  const periodicBreakdown = useMemo(
    () => calcPeriodicBreakdown(transactions, selectedMonth),
    [transactions, selectedMonth],
  );

  const handleCategoryClick = (category: string) => {
    navigate(`/transactions?category=${encodeURIComponent(category)}`);
  };

  const handleUnmarkPeriodic = (counterparty: string, amount: number) => {
    for (const txn of transactions) {
      if (
        txn.isPeriodic &&
        txn.counterparty === counterparty &&
        Math.abs(txn.amount - amount) <= 1
      ) {
        togglePeriodic(txn.id);
      }
    }
  };

  const handleCardClick = (txn: typeof transactions[number]) => {
    navigate(`/transactions?category=${encodeURIComponent(txn.category)}`);
  };

  const showMore = () => {
    setVisibleCount((prev) => prev + PAGE_SIZE);
  };

  const isLoading = !loaded;

  return (
    <div className="space-y-4">
      {/* 标题栏 */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">记账看板</h1>
        <div className="flex items-center gap-2">
          <div className="flex bg-gray-100 rounded-lg p-0.5">
            <button
              onClick={() => setViewMode('card')}
              className={`px-3 py-1 text-sm rounded-md transition-colors ${viewMode === 'card' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500'}`}
            >
              📋 卡片
            </button>
            <button
              onClick={() => setViewMode('chart')}
              className={`px-3 py-1 text-sm rounded-md transition-colors ${viewMode === 'chart' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500'}`}
            >
              📊 图表
            </button>
          </div>
        </div>
      </div>

      {/* 月份选择 */}
      <div className="flex items-center gap-2">
        <span className="text-sm text-gray-500">月份：</span>
        <div className="flex gap-1">
          {months.map((m) => (
            <button
              key={m}
              onClick={() => setSelectedMonth(m)}
              className={`px-3 py-1 text-sm rounded-lg transition-colors ${m === selectedMonth ? 'bg-blue-500 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
            >
              {m.substring(5)}月
            </button>
          ))}
        </div>
      </div>

      {/* 加载 */}
      {isLoading && (
        <div className="text-center py-12 text-gray-400">
          <p className="text-sm">加载中...</p>
        </div>
      )}

      {/* 空状态 */}
      {!isLoading && transactions.length === 0 && (
        <div className="text-center py-16 text-gray-400">
          <p className="text-5xl mb-4">📊</p>
          <p className="text-lg">暂无交易数据</p>
          <p className="text-sm mt-1">前往「设置」页面导入交易记录</p>
        </div>
      )}

      {/* ====== 卡片视图 ====== */}
      {!isLoading && transactions.length > 0 && viewMode === 'card' && (
        <>
          {/* 月度统计条 */}
          <div className="flex gap-3 text-sm">
            <div className="bg-white rounded-lg border border-gray-100 px-4 py-2 flex-1 text-center">
              <span className="text-gray-400">支出</span>{' '}
              <span className="font-bold text-red-500">{formatCurrency(monthStats.expense)}</span>
            </div>
            <div className="bg-white rounded-lg border border-gray-100 px-4 py-2 flex-1 text-center">
              <span className="text-gray-400">收入</span>{' '}
              <span className="font-bold text-green-500">{formatCurrency(monthStats.income)}</span>
            </div>
            <div className="bg-white rounded-lg border border-gray-100 px-4 py-2 flex-1 text-center">
              <span className="text-gray-400">笔数</span>{' '}
              <span className="font-bold text-gray-700">{monthStats.count}</span>
            </div>
          </div>

          {/* 分类筛选标签 */}
          <div className="flex flex-wrap gap-1.5">
            <button
              onClick={() => setCategoryFilter('')}
              className={`px-3 py-1 text-xs rounded-full transition-colors ${!categoryFilter ? 'bg-blue-500 text-white' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'}`}
            >
              全部
            </button>
            {CATEGORIES.filter((c) => c.name !== '待确认').map((cat) => (
              <button
                key={cat.name}
                onClick={() => setCategoryFilter(cat.name === categoryFilter ? '' : cat.name)}
                className={`px-3 py-1 text-xs rounded-full transition-colors ${cat.name === categoryFilter ? 'text-white' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'}`}
                style={cat.name === categoryFilter ? { backgroundColor: cat.color } : {}}
              >
                {cat.icon} {cat.name}
              </button>
            ))}
          </div>

          {/* 无匹配提示 */}
          {filteredTransactions.length === 0 && (
            <div className="text-center py-12 text-gray-400">
              <p className="text-lg">该分类下暂无交易</p>
              <button
                onClick={() => setCategoryFilter('')}
                className="text-sm text-blue-500 hover:underline mt-1"
              >
                清除筛选
              </button>
            </div>
          )}

          {/* 卡片网格 */}
          {filteredTransactions.length > 0 && (
            <>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                {visibleTransactions.map((txn) => (
                  <TransactionCard
                    key={txn.id}
                    txn={txn}
                    onClick={() => handleCardClick(txn)}
                  />
                ))}
              </div>

              {/* 显示更多按钮 */}
              {hasMore && (
                <div className="text-center">
                  <button
                    onClick={showMore}
                    className="px-6 py-2 text-sm bg-white border border-gray-200 text-gray-600 rounded-lg hover:bg-gray-50 transition-colors"
                  >
                    显示更多（{filteredTransactions.length - visibleCount} 条剩余）
                  </button>
                </div>
              )}
            </>
          )}
        </>
      )}

      {/* ===== 浮动添加按钮 ===== */}
      {viewMode === 'card' && (
        <button
          onClick={() => setShowAddModal(true)}
          className="fixed bottom-20 right-6 w-14 h-14 bg-blue-500 text-white rounded-full shadow-lg hover:bg-blue-600 transition-colors flex items-center justify-center text-2xl z-40 md:bottom-6"
          title="新增交易"
        >
          +
        </button>
      )}

      {/* 新增交易弹窗 */}
      {showAddModal && <AddTransactionModal onClose={() => setShowAddModal(false)} />}

      {/* ====== 图表视图 ====== */}
      {!isLoading && transactions.length > 0 && viewMode === 'chart' && (
        <div className="space-y-6">
          <DashboardStats metrics={metrics} />
          <MonthlyTrendChart data={trendData} />
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <CategoryPieChart data={categoryData} onCategoryClick={handleCategoryClick} />
            <DailyBarChart data={dailyData} />
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <PeriodicBreakdownChart data={periodicBreakdown} />
            <PeriodicList data={periodicData} onTogglePeriodic={handleUnmarkPeriodic} />
          </div>
        </div>
      )}
    </div>
  );
}