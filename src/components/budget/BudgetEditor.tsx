// ============================================================
// BudgetEditor 组件 - 设置/编辑分类预算（按月独立）
// ============================================================

import { useState } from 'react';
import { useBudgetStore } from '@/stores/budget-store';
import { CATEGORIES } from '@/types';
import { formatCurrency } from '@/utils/format';

interface BudgetEditorProps {
  /** 当前编辑的月份 "2026-07" */
  month: string;
}

export default function BudgetEditor({ month }: BudgetEditorProps) {
  const { budgets, getTotalBudget, setBudget, removeBudget, setTotalBudget, loadFromStorage } =
    useBudgetStore();

  const [showAdd, setShowAdd] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState('');
  const [newLimit, setNewLimit] = useState('');
  const [totalInput, setTotalInput] = useState('');
  const [editingCategory, setEditingCategory] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');

  // 确保已加载
  if (!useBudgetStore.getState().loaded) {
    loadFromStorage();
  }

  // 当前月份的总预算
  const currentTotal = getTotalBudget(month);

  // 当前月份的分类预算
  const monthBudgets = budgets.filter((b) => b.month === month);

  // 已设置预算的分类
  const budgetedCategories = new Set(monthBudgets.map((b) => b.category));

  // 可添加预算的分类（排除已设置的 + 待确认）
  const availableCategories = CATEGORIES.filter(
    (c) => c.name !== '待确认' && !budgetedCategories.has(c.name),
  );

  const handleAddBudget = () => {
    const limit = parseFloat(newLimit);
    if (!selectedCategory || isNaN(limit) || limit <= 0) return;
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
    const limit = parseFloat(editValue);
    if (isNaN(limit) || limit <= 0) return;
    setBudget(editingCategory, limit, month);
    setEditingCategory(null);
    setEditValue('');
  };

  const handleSetTotal = () => {
    const amount = parseFloat(totalInput);
    if (isNaN(amount) || amount < 0) return;
    setTotalBudget(amount, month);
    setTotalInput('');
  };

  const getCategoryInfo = (name: string) =>
    CATEGORIES.find((c) => c.name === name) ?? CATEGORIES[CATEGORIES.length - 1];

  return (
    <div className="space-y-6">
      {/* 总月度预算 */}
      <div className="bg-gray-50 rounded-lg p-4">
        <h4 className="text-sm font-semibold text-gray-700 mb-3">💰 总月度预算</h4>
        {currentTotal > 0 ? (
          <div className="flex items-center gap-3">
            <span className="text-lg font-bold text-gray-900">
              {formatCurrency(currentTotal)}
            </span>
            <span className="text-xs text-gray-400">/ {month}月</span>
            <button
              onClick={() => {
                setTotalInput(String(currentTotal));
              }}
              className="text-xs text-blue-500 hover:text-blue-600"
            >
              修改
            </button>
            <button
              onClick={() => setTotalBudget(0, month)}
              className="text-xs text-gray-400 hover:text-red-500"
            >
              取消
            </button>
          </div>
        ) : (
          <div className="flex gap-2">
            <input
              type="number"
              value={totalInput}
              onChange={(e) => setTotalInput(e.target.value)}
              placeholder={`设置 ${month} 月总预算`}
              className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
              min="0"
              step="100"
            />
            <button
              onClick={handleSetTotal}
              disabled={!totalInput || parseFloat(totalInput) <= 0}
              className="px-4 py-2 text-sm bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              设置
            </button>
          </div>
        )}
        {totalInput && currentTotal > 0 && (
          <div className="flex gap-2 mt-2">
            <input
              type="number"
              value={totalInput}
              onChange={(e) => setTotalInput(e.target.value)}
              className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
              min="0"
              step="100"
            />
            <button
              onClick={handleSetTotal}
              className="px-4 py-2 text-sm bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
            >
              保存
            </button>
            <button
              onClick={() => setTotalInput('')}
              className="px-4 py-2 text-sm bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors"
            >
              取消
            </button>
          </div>
        )}
      </div>

      {/* 分类预算列表 */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h4 className="text-sm font-semibold text-gray-700">📊 {month}月 分类预算</h4>
          {!showAdd && availableCategories.length > 0 && (
            <button
              onClick={() => setShowAdd(true)}
              className="px-3 py-1.5 text-xs bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
            >
              + 添加分类预算
            </button>
          )}
        </div>

        {/* 添加新分类预算表单 */}
        {showAdd && (
          <div className="bg-blue-50 rounded-lg p-3 mb-3 space-y-2">
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
            >
              <option value="">选择分类</option>
              {availableCategories.map((cat) => (
                <option key={cat.name} value={cat.name}>
                  {cat.icon} {cat.name}
                </option>
              ))}
            </select>
            <input
              type="number"
              value={newLimit}
              onChange={(e) => setNewLimit(e.target.value)}
              placeholder={`${month}月 预算上限（元）`}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
              min="0"
              step="100"
            />
            <div className="flex gap-2">
              <button
                onClick={handleAddBudget}
                disabled={!selectedCategory || !newLimit || parseFloat(newLimit) <= 0}
                className="px-4 py-1.5 text-sm bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                添加
              </button>
              <button
                onClick={() => {
                  setShowAdd(false);
                  setSelectedCategory('');
                  setNewLimit('');
                }}
                className="px-4 py-1.5 text-sm bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors"
              >
                取消
              </button>
            </div>
          </div>
        )}

        {/* 已设置的分类预算 */}
        {monthBudgets.length === 0 ? (
          <div className="text-center py-6 text-gray-400">
            <p className="text-sm">{month}月暂未设置分类预算</p>
            <p className="text-xs mt-1">为消费类别设置月度预算，超支时自动提醒</p>
          </div>
        ) : (
          <div className="space-y-2">
            {monthBudgets.map((budget) => {
              const cat = getCategoryInfo(budget.category);
              const isEditing = editingCategory === budget.category;

              return (
                <div
                  key={`${budget.category}-${budget.month}`}
                  className="flex items-center gap-3 bg-white border border-gray-100 rounded-lg p-3"
                >
                  {/* 分类图标+名称 */}
                  <span
                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium flex-shrink-0"
                    style={{ backgroundColor: cat.color + '18', color: cat.color }}
                  >
                    {cat.icon} {budget.category}
                  </span>

                  {/* 预算金额 */}
                  {isEditing ? (
                    <div className="flex-1 flex gap-2">
                      <input
                        type="number"
                        value={editValue}
                        onChange={(e) => setEditValue(e.target.value)}
                        className="flex-1 px-2 py-1 border border-blue-300 rounded text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                        min="0"
                        step="100"
                        autoFocus
                        onKeyDown={(e) => e.key === 'Enter' && handleSaveEdit()}
                      />
                      <button
                        onClick={handleSaveEdit}
                        className="px-2 py-1 text-xs bg-blue-500 text-white rounded hover:bg-blue-600"
                      >
                        保存
                      </button>
                      <button
                        onClick={() => setEditingCategory(null)}
                        className="px-2 py-1 text-xs bg-gray-200 text-gray-600 rounded hover:bg-gray-300"
                      >
                        取消
                      </button>
                    </div>
                  ) : (
                    <span className="flex-1 text-sm font-medium text-gray-900">
                      {formatCurrency(budget.monthlyLimit)}
                      <span className="text-xs text-gray-400 font-normal">/月</span>
                    </span>
                  )}

                  {/* 操作按钮 */}
                  {!isEditing && (
                    <div className="flex gap-1 flex-shrink-0">
                      <button
                        onClick={() => handleStartEdit(budget.category, budget.monthlyLimit)}
                        className="p-1 text-gray-400 hover:text-blue-500 transition-colors text-sm"
                        title="编辑"
                      >
                        ✎
                      </button>
                      <button
                        onClick={() => removeBudget(budget.category, month)}
                        className="p-1 text-gray-400 hover:text-red-500 transition-colors text-sm"
                        title="删除"
                      >
                        ✕
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}