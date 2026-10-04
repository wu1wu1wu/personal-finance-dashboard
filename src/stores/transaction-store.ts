// ============================================================
// 交易数据 Store - Zustand 状态管理
// ============================================================

import { create } from 'zustand';
import type { Transaction, FilterOptions, Budget } from '@/types';
import { STORAGE_KEYS } from '@/types';
import { storage } from '@/storage/StorageAdapter';
import { queuePersist } from '@/storage/persist-queue';
import { coverKey, hydrateCovers, migrateInlineCovers, saveCover, stripCovers } from '@/storage/cover-store';
import { classifyTransaction } from '@/core/classifier';
import { clearedNotePatch, normalizeNote } from '@/core/transaction-note';
import { getPeriodicTransactions, markPeriodicTransactions } from '@/core/periodic-engine';
import {
  addTrashEntry,
  createTrashEntry,
  pruneTrash,
  restoreTransactions,
} from '@/core/trash';
import type { TrashEntry } from '@/core/trash';

/**
 * 清掉这些批次里交易的封面图。
 * 删除时故意不清（撤销还要用），只有批次被淘汰或用户清空回收站时才真正删。
 */
async function dropCoverImages(entries: TrashEntry[]): Promise<void> {
  for (const entry of entries) {
    for (const txn of entry.transactions) {
      await storage.remove(coverKey(txn.id));
    }
  }
}

interface TransactionStore {
  /** 所有交易记录 */
  transactions: Transaction[];
  /** 最近删除（回收站）：删除先入这里，可从底部撤销条或设置页找回 */
  trash: TrashEntry[];
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
  /** 账单回填：把补全后的完整交易列表写回 */
  applyReconcile: (next: Transaction[]) => void;
  /** 手动添加单条交易 */
  addTransaction: (txn: Transaction) => void;
  /** 更新单条交易的分类 */
  updateCategory: (id: string, category: string) => void;
  /** 编辑单条交易的内容（金额/时间/对方/描述/主题）；编辑后标记 userEdited，不再被账单回填覆盖 */
  updateTransaction: (
    id: string,
    patch: Partial<
      Pick<
        Transaction,
        'amount' | 'transactionTime' | 'counterparty' | 'description' | 'theme' | 'paymentMethod'
      >
    >,
  ) => void;
  /** 批量更新分类（待确认收件箱多选归类） */
  updateCategoryBatch: (ids: string[], category: string) => void;
  /** 按各自的分类批量写回（重新识别待确认记录用） */
  applyCategories: (updates: { id: string; category: string }[]) => number;
  /** 切换周期性标记 */
  togglePeriodic: (id: string) => void;
  /** 批量切换周期性标记（看板取消周期订阅时一次写完，避免逐条全量落盘） */
  togglePeriodicBatch: (ids: string[]) => void;
  /** 添加标签 */
  addTag: (id: string, tag: string) => void;
  /** 移除标签 */
  removeTag: (id: string, tag: string) => void;
  /** 删除单条交易（进入最近删除，可撤销）；返回回收站批次 id，null 表示没删成 */
  deleteTransaction: (id: string) => string | null;
  /**
   * 按月份批量删除交易，返回删除的笔数。
   * extra 用于把同一次清理里删掉的预算也一起存进回收站，撤销时一并恢复。
   */
  deleteByMonths: (
    months: string[],
    extra?: { label?: string; budgets?: Budget[]; totalBudgets?: Record<string, number> },
  ) => number;
  /** 撤销一批删除：把交易放回去，返回该批次（调用方据此恢复预算） */
  restoreTrashEntry: (entryId: string) => TrashEntry | null;
  /** 清空最近删除（同时清掉这些交易的封面图） */
  clearTrash: () => void;
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
  /** 设置交易手记（纯文字；字段沿用旧名 theme） */
  setTheme: (id: string, theme: string) => void;
  /** 一次清空手记：文字与配图一起清（卡片随之消失） */
  clearNote: (id: string) => void;
  /** 持久化到 localStorage */
  persist: () => Promise<void>;
  /** 自动标记周期性交易（数据加载与导入后调用） */
  autoMarkPeriodic: () => void;
}

export const useTransactionStore = create<TransactionStore>((set, get) => ({
  transactions: [],
  trash: [],
  loaded: false,
  importing: false,
  importMessage: null,

  loadFromStorage: async () => {
    if (get().loaded) return;
    const [data, storedTrash] = await Promise.all([
      storage.get<Transaction[]>(STORAGE_KEYS.TRANSACTIONS),
      storage.get<TrashEntry[]>(STORAGE_KEYS.TRASH),
    ]);

    // 最近删除：加载时就剪枝，过期批次的封面图一并清掉
    const pruned = pruneTrash(Array.isArray(storedTrash) ? storedTrash : []);
    if (pruned.dropped.length > 0) {
      await dropCoverImages(pruned.dropped);
      void storage.set(STORAGE_KEYS.TRASH, pruned.entries);
    }
    set({ trash: pruned.entries });

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
    // 一次性数据迁移：
    // 1. 补齐 origin（老数据没有这个字段），按交易单号推断来源
    // 2. 新增「转账」分类后，把此前自动归到「其他」的转账类记录改判
    //    只动 categorySource === 'auto' 的记录，用户手动改过的分类不覆盖
    let changed = 0;
    const migrated = valid.map((t) => {
      let next = t;

      if (!next.origin) {
        const no = next.transactionNo || '';
        const origin: Transaction['origin'] = no.startsWith('auto-')
          ? 'auto'
          : no.startsWith('manual-')
            ? 'manual'
            : 'import';
        next = { ...next, origin };
      }

      if (next.category === '其他' && next.categorySource === 'auto') {
        const category = classifyTransaction(next, []);
        if (category !== next.category) {
          next = { ...next, category };
        }
      }

      // 老数据分不清「用户手动改的分类」和「规则指定的分类」（当时都写成 manual），
      // 保守当作用户改过，宁可不回填也不要覆盖用户数据。
      if (next.origin === 'auto' && next.categorySource === 'manual' && next.userEdited === undefined) {
        next = { ...next, userEdited: true };
      }

      // 补齐老数据的 theme / coverImage，避免读取时是 undefined
      if (typeof next.theme !== 'string') {
        next = { ...next, theme: '' };
      }
      if (typeof next.coverImage !== 'string') {
        next = { ...next, coverImage: '' };
      }

      if (next !== t) changed++;
      return next;
    });
    if (changed > 0) {
      console.log(`[迁移] 已迁移 ${changed} 条记录`);
      await storage.set(STORAGE_KEYS.TRANSACTIONS, migrated);
    }

    // 封面图从主记录里拆出来单独存：先把老数据的内嵌图片搬走，再读回独立键上的图片。
    // 内存里依旧挂着 coverImage，UI 与导出逻辑都不用改。
    const detached = await migrateInlineCovers(migrated);
    if (detached !== migrated) {
      await storage.set(STORAGE_KEYS.TRANSACTIONS, stripCovers(detached));
    }
    const hydrated = await hydrateCovers(detached);

    set({ transactions: hydrated, loaded: true });
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
    // 通知/短信可能被实时推送和队列重放各送一次，同 id 不再重复入账
    if (get().transactions.some((t) => t.id === txn.id)) return;
    set((state) => ({
      transactions: [txn, ...state.transactions],
    }));
    get().persist();
  },

  updateCategoryBatch: (ids, category) => {
    if (ids.length === 0) return;
    const idSet = new Set(ids);
    set((state) => ({
      transactions: state.transactions.map((t) =>
        idSet.has(t.id) ? { ...t, category, categorySource: 'manual', userEdited: true } : t,
      ),
    }));
    get().persist();
  },

  applyCategories: (updates) => {
    if (updates.length === 0) return 0;
    const byId = new Map(updates.map((u) => [u.id, u.category]));
    set((state) => ({
      transactions: state.transactions.map((t) => {
        const category = byId.get(t.id);
        return category ? { ...t, category, categorySource: 'auto' } : t;
      }),
    }));
    get().persist();
    return updates.length;
  },

  deleteByMonths: (months, extra) => {
    if (months.length === 0) return 0;
    const monthSet = new Set(months);
    const removed = get().transactions.filter((t) =>
      monthSet.has(t.transactionTime.substring(0, 7)),
    );
    if (removed.length === 0) return 0;

    // 整批入回收站（含同一次清理删掉的预算），用户可以从设置页整批恢复
    const entry = createTrashEntry({
      reason: 'months',
      label: extra?.label ?? [...months].sort().join('、'),
      transactions: removed,
      budgets: extra?.budgets,
      totalBudgets: extra?.totalBudgets,
    });
    const pruned = addTrashEntry(get().trash, entry);

    set((state) => ({
      transactions: state.transactions.filter(
        (t) => !monthSet.has(t.transactionTime.substring(0, 7)),
      ),
      trash: pruned.entries,
    }));
    void dropCoverImages(pruned.dropped);
    get().persist();
    return removed.length;
  },

  restoreTrashEntry: (entryId) => {
    const entry = get().trash.find((e) => e.id === entryId);
    if (!entry) return null;

    set((state) => ({
      transactions: restoreTransactions(entry, state.transactions),
      trash: state.trash.filter((e) => e.id !== entryId),
    }));
    get().persist();
    get().autoMarkPeriodic();
    return entry;
  },

  clearTrash: () => {
    const { trash } = get();
    if (trash.length === 0) return;
    set({ trash: [] });
    void dropCoverImages(trash);
    get().persist();
  },

  applyReconcile: (next) => {
    set({ transactions: next });
    get().persist();
    get().autoMarkPeriodic();
  },

  updateCategory: (id, category) => {
    set((state) => ({
      transactions: state.transactions.map((t) =>
        t.id === id
          ? { ...t, category, categorySource: 'manual' as const, userEdited: true }
          : t,
      ),
    }));
    get().persist();
  },

  updateTransaction: (id, patch) => {
    set((state) => ({
      transactions: state.transactions.map((t) =>
        // id 不重算：去重、封面键、标签都挂在 id 上，改了会让这些都错位
        t.id === id ? { ...t, ...patch, userEdited: true } : t,
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

  togglePeriodicBatch: (ids) => {
    if (ids.length === 0) return;
    const idSet = new Set(ids);
    set((state) => ({
      transactions: state.transactions.map((t) =>
        idSet.has(t.id) ? { ...t, isPeriodic: !t.isPeriodic } : t,
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
    const target = get().transactions.find((t) => t.id === id);
    if (!target) return null;

    // 先入回收站再删：封面图**不立即清**，撤销时还要用
    const entry = createTrashEntry({
      reason: 'single',
      label: target.counterparty || target.description || '单笔交易',
      transactions: [target],
    });
    const pruned = addTrashEntry(get().trash, entry);

    set((state) => ({
      transactions: state.transactions.filter((t) => t.id !== id),
      trash: pruned.entries,
    }));
    void dropCoverImages(pruned.dropped);
    get().persist();
    return entry.id;
  },

  clearAll: async () => {
    // 回收站与封面图一起清，否则"清除所有数据"之后还能从回收站翻出旧记录
    const { trash } = get();
    set({ transactions: [], trash: [] });
    await dropCoverImages(trash);
    await Promise.all([
      storage.remove(STORAGE_KEYS.TRANSACTIONS),
      storage.remove(STORAGE_KEYS.TRASH),
    ]);
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
    // 图片单独落盘，主数组里不留 base64
    void saveCover(id, coverImage);
    get().persist();
  },

  setTheme: (id, theme) => {
    // 入口统一清洗：卡片、详情弹窗、以后别的地方写进来的手记都守同一条上限
    const next = normalizeNote(theme);
    set((state) => ({
      transactions: state.transactions.map((t) => (t.id === id ? { ...t, theme: next } : t)),
    }));
    get().persist();
  },

  clearNote: (id) => {
    // 文字与配图必须在同一次 set 里清掉：分两次写会对整个数组多序列化一遍，
    // 而且中间那一帧会出现「文字没了、图还在」的半截状态。
    const patch = clearedNotePatch();
    set((state) => ({
      transactions: state.transactions.map((t) => (t.id === id ? { ...t, ...patch } : t)),
    }));
    // 图片单独落盘，这里顺手把图片键删掉，别留下再也用不到的孤儿数据
    void saveCover(id, '');
    get().persist();
  },

  persist: async () => {
    // 走持久化队列：写失败会挂到 usePersistStatus 上提示用户，而不是静默丢失。
    // 封面图不在主记录里（见 cover-store），写盘前统一剥离，避免每次改动都序列化几 MB 图片。
    // 回收站与交易一起写：它们是同一次删除的两半，分开写容易出现"删了但撤不回"。
    queuePersist('transactions', async () => {
      await Promise.all([
        storage.set(STORAGE_KEYS.TRANSACTIONS, stripCovers(get().transactions)),
        storage.set(STORAGE_KEYS.TRASH, get().trash),
      ]);
    });
  },

  autoMarkPeriodic: () => {
    const { transactions } = get();
    if (transactions.length === 0) return;
    const periodicList = getPeriodicTransactions(transactions);
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
