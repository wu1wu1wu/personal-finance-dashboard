// ============================================================
// 预算管理页面 - 总预算+分类预算+预警状态
// ============================================================

import { useEffect, useMemo, useState } from 'react';
import { useBudgetStore } from '@/stores/budget-store';
import { useTransactionStore } from '@/stores/transaction-store';
import { calcBudgetStatus, calcTotalBudgetStatus } from '@/core/budget-engine';
import BudgetProgressBar from '@/components/budget/BudgetProgressBar';
import BudgetEditor from '@/components/budget/BudgetEditor';
import { getCurrentMonth, getRecentMonths } from '@/utils/date';
import type { BudgetStatus } from '@/types';

export default function Budget() {
  const { budgets, totalBudgets, loaded: budgetLoaded, loadFromStorage: loadBudgets } =
    useBudgetStore();
  const { transactions, loaded: txnLoaded, loadFromStorage: loadTxns } =
    useTransactionStore();

  const [selectedMonth, setSelectedMonth] = useState(getCurrentMonth());
  const [showEditor, setShowEditor] = useState(false);

  // 加载数据
  useEffect(() => {
    loadBudgets();
    loadTxns();
  }, [loadBudgets, loadTxns]);

  // 月份选择列表（近6个月）
  const months = useMemo(() => getRecentMonths(6), []);

  // 计算分类预算状态
  const budgetStatuses: BudgetStatus[] = useMemo(() => {
    if (!txnLoaded || !budgetLoaded) return [];
    return calcBudgetStatus(transactions, budgets, selectedMonth);
  }, [transactions, budgets, selectedMonth, txnLoaded, budgetLoaded]);

  // 计算总预算状态
  const totalStatus = useMemo(() => {
    if (!txnLoaded || !budgetLoaded) return null;
    return calcTotalBudgetStatus(transactions, totalBudgets, selectedMonth);
  }, [transactions, totalBudgets, selectedMonth, txnLoaded, budgetLoaded]);

  // 预警统计
  const warningCount = budgetStatuses.filter((s) => s.level === 'warning').length;
  const exceededCount = budgetStatuses.filter((s) => s.level === 'exceeded').length;

  const isLoading = !txnLoaded || !budgetLoaded;

  return (
    <div className="space-y-6">
      {/* 标题栏 */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">预算管理</h1>
        <button
          onClick={() => setShowEditor(!showEditor)}
          className="px-3 py-1.5 text-sm bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
        >
          {showEditor ? '完成设置' : '⚙️ 设置预算'}
        </button>
      </div>

      {/* 预算设置面板（可折叠） */}
      {showEditor && (
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <BudgetEditor month={selectedMonth} />
        </div>
      )}

      {/* 月份选择 */}
      <div className="flex items-center gap-2">
        <span className="text-sm text-gray-500">查看月份：</span>
        <div className="flex gap-1">
          {months.map((m) => (
            <button
              key={m}
              onClick={() => setSelectedMonth(m)}
              className={`px-3 py-1 text-sm rounded-lg transition-colors ${
                m === selectedMonth
                  ? 'bg-blue-500 text-white'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {m.substring(5)}月
            </button>
          ))}
        </div>
      </div>

      {/* 加载状态 */}
      {isLoading && (
        <div className="text-center py-8 text-gray-400">
          <p className="text-sm">加载中...</p>
        </div>
      )}

      {/* 无预算提示 */}
      {!isLoading && budgets.length === 0 && Object.keys(totalBudgets).length === 0 && (
        <div className="text-center py-12 text-gray-400">
          <p className="text-5xl mb-4">💰</p>
          <p className="text-lg">尚未设置预算</p>
          <p className="text-sm mt-1">点击"设置预算"为消费类别设置月度预算</p>
        </div>
      )}

      {/* 预算概览 */}
      {!isLoading && (budgets.length > 0 || Object.keys(totalBudgets).length > 0) && (
        <>
          {/* 预警摘要 */}
          {(warningCount > 0 || exceededCount > 0) && (
            <div
              className={`rounded-lg p-3 flex items-center gap-3 ${
                exceededCount > 0
                  ? 'bg-red-50 border border-red-200'
                  : 'bg-yellow-50 border border-yellow-200'
              }`}
            >
              <span className="text-xl">{exceededCount > 0 ? '🚨' : '⚠️'}</span>
              <div className="text-sm">
                {exceededCount > 0 && (
                  <span className="text-red-700 font-medium">
                    {exceededCount} 个分类已超支
                  </span>
                )}
                {warningCount > 0 && exceededCount > 0 && <span>，</span>}
                {warningCount > 0 && (
                  <span className="text-yellow-700 font-medium">
                    {warningCount} 个分类接近预算
                  </span>
                )}
              </div>
            </div>
          )}

          {/* 总预算进度 */}
          {totalStatus && (
            <div>
              <h3 className="text-sm font-semibold text-gray-700 mb-2">总预算执行</h3>
              <BudgetProgressBar status={totalStatus} isTotal />
            </div>
          )}

          {/* 分类预算进度 */}
          {budgetStatuses.length > 0 && (
            <div>
              <h3 className="text-sm font-semibold text-gray-700 mb-2">分类预算执行</h3>
              <div className="space-y-2">
                {/* 超支的分类排在最前 */}
                {[...budgetStatuses]
                  .sort((a, b) => {
                    const order = { exceeded: 0, warning: 1, normal: 2 };
                    return order[a.level] - order[b.level];
                  })
                  .map((status) => (
                    <BudgetProgressBar key={status.category} status={status} />
                  ))}
              </div>
            </div>
          )}

          {/* 无分类预算提示 */}
          {budgets.filter((b) => b.month === selectedMonth).length === 0 && (totalBudgets[selectedMonth] ?? totalBudgets[''] ?? 0) > 0 && (
            <div className="text-center py-6 text-gray-400">
              <p className="text-sm">已设置总预算，但未设置分类预算</p>
              <p className="text-xs mt-1">
                为各消费类别单独设置预算，可更精细地控制支出
              </p>
            </div>
          )}
        </>
      )}
    </div>
  );
}