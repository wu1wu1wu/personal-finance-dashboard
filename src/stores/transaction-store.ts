// ============================================================
// 交易数据 Store - Zustand 状态管理
// ============================================================

import { create } from 'zustand';
import type { Transaction, FilterOptions } from '@/types';
import { STORAGE_KEYS } from '@/types';
import { storage } from '@/storage/StorageAdapter';
import { detectPeriodicTransactions, markPeriodicTransactions } from '@/core/periodic-engine';

interface TransactionStore {
  /** 所有交易记录 */
  transactions: Transaction[];
  /** 是否已从存储加载 */
  loaded: boolean;
  /** 是否正在导入 */
  importing: boolean;
  /** 导入结果消息 */
  importMessage: string | null;

  // ---- Actions ----

  /** 从 localStorage 加载数据 */
  loadFromStorage: () => Promise<void>;
  /** 添加新交易（导入时使用，自动去重） */
  addTransactions: (txns: Transaction[]) => number;
  /** 手动添加单条交易 */
  addTransaction: (txn: Transaction) => void;
  /** 更新单条交易的分类 */
  updateCategory: (id: string, category: string) => void;
  /** 切换周期性标记 */
  togglePeriodic: (id: string) => void;
  /** 添加标签 */
  addTag: (id: string, tag: string) => void;
  /** 移除标签 */
  removeTag: (id: string, tag: string) => void;
  /** 删除单条交易 */
  deleteTransaction: (id: string) => void;
  /** 清空所有交易 */
  clearAll: () => Promise<void>;
  /** 按筛选条件获取交易 */
  getFiltered: (filters: FilterOptions) => Transaction[];
  /** 获取所有交易ID集合（用于去重） */
  getExistingIds: () => Set<string>;
  /** 设置导入状态 */
  setImporting: (importing: boolean, message?: string | null) => void;
  /** 设置交易封面图 */
  setCoverImage: (id: string, coverImage: string) => void;
  /** 持久化到 localStorage */
  persist: () => Promise<void>;
  /** 自动标记周期性交易（数据加载与导入后调用） */
  autoMarkPeriodic: () => void;
}

export const useTransactionStore = create<TransactionStore>((set, get) => ({
  transactions: [],
  loaded: false,
  importing: false,
  importMessage: null,

  loadFromStorage: async () => {
    if (get().loaded) return;
    const data = await storage.get<Transaction[]>(STORAGE_KEYS.TRANSACTIONS);
    if (!data) {
      set({ transactions: [], loaded: true });
      return;
    }
    // 自动清理旧版本损坏的数据（Excel日期序列号格式的transactionTime）
    const valid = data.filter((t) => {
      const time = t.transactionTime;
      // 正常日期格式: "2026-06-30 21:26:00" 或类似
      // Excel序列号: "46203.89..." — 以数字开头且包含小数点
      if (/^\d{4,5}\.\d+/.test(time)) {
        console.warn('[迁移] 已清理损坏的旧记录:', t.counterparty, time);
        return false;
      }
      return true;
    });
    if (valid.length < data.length) {
      console.log(`[迁移] 清理了 ${data.length - valid.length} 条损坏记录，剩余 ${valid.length} 条`);
      await storage.set(STORAGE_KEYS.TRANSACTIONS, valid);
    }
    set({ transactions: valid, loaded: true });
    get().autoMarkPeriodic();
  },

  addTransactions: (txns) => {
    const existingIds = get().getExistingIds();
    const newTxns = txns.filter((t) => !existingIds.has(t.id));
    if (newTxns.length === 0) return 0;
    set((state) => ({
      transactions: [...state.transactions, ...newTxns],
    }));
    get().persist();
    get().autoMarkPeriodic();
    return newTxns.length;
  },

  addTransaction: (txn) => {
    set((state) => ({
      transactions: [txn, ...state.transactions],
    }));
    get().persist();
  },

  updateCategory: (id, category) => {
    set((state) => ({
      transactions: state.transactions.map((t) =>
        t.id === id ? { ...t, category, categorySource: 'manual' as const } : t,
      ),
    }));
    get().persist();
  },

  togglePeriodic: (id) => {
    set((state) => ({
      transactions: state.transactions.map((t) =>
        t.id === id ? { ...t, isPeriodic: !t.isPeriodic } : t,
      ),
    }));
    get().persist();
  },

  addTag: (id, tag) => {
    set((state) => ({
      transactions: state.transactions.map((t) =>
        t.id === id && !t.tags.includes(tag)
          ? { ...t, tags: [...t.tags, tag] }
          : t,
      ),
    }));
    get().persist();
  },

  removeTag: (id, tag) => {
    set((state) => ({
      transactions: state.transactions.map((t) =>
        t.id === id ? { ...t, tags: t.tags.filter((tg) => tg !== tag) } : t,
      ),
    }));
    get().persist();
  },

  deleteTransaction: (id) => {
    set((state) => ({
      transactions: state.transactions.filter((t) => t.id !== id),
    }));
    get().persist();
  },

  clearAll: async () => {
    set({ transactions: [] });
    await storage.remove(STORAGE_KEYS.TRANSACTIONS);
  },

  getFiltered: (filters) => {
    const { transactions } = get();
    return transactions.filter((t) => {
      // 月份筛选
      if (filters.month && !t.transactionTime.startsWith(filters.month)) return false;
      // 类别筛选
      if (filters.category && t.category !== filters.category) return false;
      // 金额范围
      if (filters.minAmount !== undefined && Math.abs(t.amount) < filters.minAmount) return false;
      if (filters.maxAmount !== undefined && Math.abs(t.amount) > filters.maxAmount) return false;
      // 关键词搜索（匹配交易对方或商品说明）
      if (filters.keyword) {
        const kw = filters.keyword.toLowerCase();
        const match =
          t.counterparty.toLowerCase().includes(kw) ||
          t.description.toLowerCase().includes(kw);
        if (!match) return false;
      }
      return true;
    }).sort((a, b) => b.transactionTime.localeCompare(a.transactionTime));
  },

  getExistingIds: () => {
    return new Set(get().transactions.map((t) => t.id));
  },

  setImporting: (importing, message = null) => {
    set({ importing, importMessage: message });
  },

  setCoverImage: (id, coverImage) => {
    set((state) => ({
      transactions: state.transactions.map((t) =>
        t.id === id ? { ...t, coverImage } : t,
      ),
    }));
    get().persist();
  },

  persist: async () => {
    const { transactions } = get();
    await storage.set(STORAGE_KEYS.TRANSACTIONS, transactions);
  },

  autoMarkPeriodic: () => {
    const { transactions } = get();
    if (transactions.length === 0) return;
    const periodicList = detectPeriodicTransactions(transactions);
    const newlyMarked = markPeriodicTransactions(transactions, periodicList);
    if (newlyMarked.length === 0) return;
    const idSet = new Set(newlyMarked);
    set((state) => ({
      transactions: state.transactions.map((t) =>
        idSet.has(t.id) ? { ...t, isPeriodic: true } : t,
      ),
    }));
    get().persist();
  },
}));