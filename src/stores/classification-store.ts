// ============================================================
// 分类规则 Store - Zustand 状态管理
// ============================================================

import { create } from 'zustand';
import type { ClassificationRule } from '@/types';
import { STORAGE_KEYS } from '@/types';
import { storage } from '@/storage/StorageAdapter';
import { BUILTIN_RULES } from '@/constants/rules';
import { processFeedback } from '@/core/classifier';

/** 分类反馈记录 */
interface FeedbackEntry {
  category: string;
  count: number;
}

interface ClassificationStore {
  /** 自定义规则 */
  customRules: ClassificationRule[];
  /** 分类反馈记录 { 关键词: { category, count } } */
  feedback: Record<string, FeedbackEntry>;
  /** 是否已加载 */
  loaded: boolean;

  // ---- Actions ----

  /** 从 localStorage 加载 */
  loadFromStorage: () => Promise<void>;
  /** 添加自定义规则 */
  addCustomRule: (rule: Omit<ClassificationRule, 'id' | 'isCustom' | 'hitCount' | 'priority'>) => void;
  /** 更新自定义规则 */
  updateCustomRule: (id: string, updates: Partial<Pick<ClassificationRule, 'keywords' | 'category'>>) => void;
  /** 删除自定义规则 */
  deleteCustomRule: (id: string) => void;
  /** 记录分类修正反馈 */
  recordFeedback: (keyword: string, correctedCategory: string) => void;
  /** 获取所有规则（内置 + 自定义） */
  getAllRules: () => ClassificationRule[];
  /** 持久化 */
  persist: () => Promise<void>;
}

export const useClassificationStore = create<ClassificationStore>((set, get) => ({
  customRules: [],
  feedback: {},
  loaded: false,

  loadFromStorage: async () => {
    if (get().loaded) return;
    const [rules, feedback] = await Promise.all([
      storage.get<ClassificationRule[]>(STORAGE_KEYS.CUSTOM_RULES),
      storage.get<Record<string, FeedbackEntry>>(STORAGE_KEYS.CATEGORY_FEEDBACK),
    ]);
    set({
      customRules: rules ?? [],
      feedback: feedback ?? {},
      loaded: true,
    });
  },

  addCustomRule: (rule) => {
    const newRule: ClassificationRule = {
      ...rule,
      id: `rule-custom-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      isCustom: true,
      priority: 100,
      hitCount: 0,
    };
    set((state) => ({
      customRules: [...state.customRules, newRule],
    }));
    get().persist();
  },

  updateCustomRule: (id, updates) => {
    set((state) => ({
      customRules: state.customRules.map((r) =>
        r.id === id ? { ...r, ...updates } : r,
      ),
    }));
    get().persist();
  },

  deleteCustomRule: (id) => {
    set((state) => ({
      customRules: state.customRules.filter((r) => r.id !== id),
    }));
    get().persist();
  },

  recordFeedback: (keyword, correctedCategory) => {
    set((state) => {
      const existing = state.feedback[keyword];
      const newCount = existing ? existing.count + 1 : 1;

      const newFeedback = {
        ...state.feedback,
        [keyword]: { category: correctedCategory, count: newCount },
      };

      // 检查是否需要自动提升为自定义规则
      const newRules = processFeedback(newFeedback, state.customRules);

      return {
        feedback: newFeedback,
        customRules: [...state.customRules, ...newRules],
      };
    });
    get().persist();
  },

  getAllRules: () => {
    const { customRules } = get();
    return [...BUILTIN_RULES, ...customRules];
  },

  persist: async () => {
    const { customRules, feedback } = get();
    await Promise.all([
      storage.set(STORAGE_KEYS.CUSTOM_RULES, customRules),
      storage.set(STORAGE_KEYS.CATEGORY_FEEDBACK, feedback),
    ]);
  },
}));