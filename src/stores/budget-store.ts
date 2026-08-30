// ============================================================
// 预算 Store - Zustand 状态管理（支持按月独立预算）
// ============================================================

import { create } from 'zustand';
import type { Budget } from '@/types';
import { STORAGE_KEYS, CATEGORIES } from '@/types';
import { storage } from '@/storage/StorageAdapter';

interface BudgetStore {
  /** 分类预算列表（每条带month字段） */
  budgets: Budget[];
  /** 总月度预算（按月份键索引: { "2026-07": 3000, "2026-08": 2500 }） */
  totalBudgets: Record<string, number>;
  /** 是否已加载 */
  loaded: boolean;

  // ---- Actions ----

  /** 从 localStorage 加载 */
  loadFromStorage: () => Promise<void>;
  /** 设置指定月份的分类预算 */
  setBudget: (category: string, monthlyLimit: number, month: string) => void;
  /** 删除指定月份的分类预算 */
  removeBudget: (category: string, month: string) => void;
  /** 设置指定月份的总预算 */
  setTotalBudget: (amount: number, month: string) => void;
  /** 获取指定月份的总预算 */
  getTotalBudget: (month: string) => number;
  /** 清空所有预算 */
  clearAll: () => void;
  /** 持久化 */
  persist: () => Promise<void>;
}

export const useBudgetStore = create<BudgetStore>((set, get) => ({
  budgets: [],
  totalBudgets: {},
  loaded: false,

  loadFromStorage: async () => {
    if (get().loaded) return;
    const [budgets, totalBudgets] = await Promise.all([
      storage.get<Budget[]>(STORAGE_KEYS.BUDGETS),
      storage.get<Record<string, number>>(STORAGE_KEYS.TOTAL_BUDGETS),
    ]);

    let migratedBudgets = budgets ?? [];
    let migratedTotals = totalBudgets ?? {};

    // 旧数据迁移：旧Budget没有month字段，补充为空字符串（视为全局通用）
    if (migratedBudgets.length > 0 && !('month' in migratedBudgets[0])) {
      migratedBudgets = migratedBudgets.map((b) => ({
        category: b.category,
        monthlyLimit: b.monthlyLimit,
        color: b.color,
        month: '',
      }));
    }

    // 旧数据迁移：旧的 totalBudget(number) → totalBudgets(Record)
    if (!totalBudgets || Object.keys(migratedTotals).length === 0) {
      const oldTotal = await storage.get<number>('pfd_total_budget');
      if (oldTotal && oldTotal > 0) {
        // 旧格式的单数值无法确定是哪个月的，设为空字符串键（所有月份通用）
        migratedTotals = { '': oldTotal };
        await storage.set(STORAGE_KEYS.TOTAL_BUDGETS, migratedTotals);
        await storage.remove('pfd_total_budget');
      }
    }

    set({
      budgets: migratedBudgets,
      totalBudgets: migratedTotals,
      loaded: true,
    });
  },

  setBudget: (category, monthlyLimit, month) => {
    set((state) => {
      const existing = state.budgets.find(
        (b) => b.category === category && b.month === month,
      );
      if (existing) {
        return {
          budgets: state.budgets.map((b) =>
            b.category === category && b.month === month
              ? { ...b, monthlyLimit }
              : b,
          ),
        };
      }
      const cat = CATEGORIES.find((c) => c.name === category);
      return {
        budgets: [
          ...state.budgets,
          { category, monthlyLimit, color: cat?.color ?? '#6B7280', month },
        ],
      };
    });
    get().persist();
  },

  removeBudget: (category, month) => {
    set((state) => ({
      budgets: state.budgets.filter(
        (b) => !(b.category === category && b.month === month),
      ),
    }));
    get().persist();
  },

  setTotalBudget: (amount, month) => {
    set((state) => ({
      totalBudgets: { ...state.totalBudgets, [month]: amount },
    }));
    get().persist();
  },

  getTotalBudget: (month) => {
    const { totalBudgets } = get();
    // 优先精确月份匹配，否则查空字符串（旧数据/通用预算）
    return totalBudgets[month] ?? totalBudgets[''] ?? 0;
  },

  clearAll: () => {
    set({ budgets: [], totalBudgets: {} });
    get().persist();
  },

  persist: async () => {
    const { budgets, totalBudgets } = get();
    await Promise.all([
      storage.set(STORAGE_KEYS.BUDGETS, budgets),
      storage.set(STORAGE_KEYS.TOTAL_BUDGETS, totalBudgets),
    ]);
  },
}));