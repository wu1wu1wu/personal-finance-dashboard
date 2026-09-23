// ============================================================
// 消息读取规则 Store - 自动记账的自定义规则与全局忽略设置
// ============================================================

import { create } from 'zustand';
import type { CaptureRule, CaptureSettings } from '@/types';
import { STORAGE_KEYS } from '@/types';
import { storage } from '@/storage/StorageAdapter';
import { generateId } from '@/utils/id';

const DEFAULT_SETTINGS: CaptureSettings = {
  ignorePackages: [],
  ignoreKeywords: [],
};

interface CaptureRuleStore {
  rules: CaptureRule[];
  settings: CaptureSettings;
  loaded: boolean;

  loadFromStorage: () => Promise<void>;
  addRule: (rule: Omit<CaptureRule, 'id'>) => void;
  updateRule: (id: string, patch: Partial<CaptureRule>) => void;
  removeRule: (id: string) => void;
  setSettings: (patch: Partial<CaptureSettings>) => void;
  clearAll: () => void;
  persist: () => Promise<void>;
}

export const useCaptureRuleStore = create<CaptureRuleStore>((set, get) => ({
  rules: [],
  settings: DEFAULT_SETTINGS,
  loaded: false,

  loadFromStorage: async () => {
    if (get().loaded) return;
    const [rules, settings] = await Promise.all([
      storage.get<CaptureRule[]>(STORAGE_KEYS.CAPTURE_RULES),
      storage.get<CaptureSettings>(STORAGE_KEYS.CAPTURE_SETTINGS),
    ]);
    set({
      rules: rules ?? [],
      // 老数据没有这两个字段时补默认值，避免读取时 undefined
      settings: {
        ignorePackages: settings?.ignorePackages ?? [],
        ignoreKeywords: settings?.ignoreKeywords ?? [],
      },
      loaded: true,
    });
  },

  addRule: (rule) => {
    const id = generateId(`capture-rule-${Date.now()}-${Math.random()}`);
    set((state) => ({ rules: [...state.rules, { ...rule, id }] }));
    get().persist();
  },

  updateRule: (id, patch) => {
    set((state) => ({
      rules: state.rules.map((r) => (r.id === id ? { ...r, ...patch } : r)),
    }));
    get().persist();
  },

  removeRule: (id) => {
    set((state) => ({ rules: state.rules.filter((r) => r.id !== id) }));
    get().persist();
  },

  setSettings: (patch) => {
    set((state) => ({ settings: { ...state.settings, ...patch } }));
    get().persist();
  },

  clearAll: () => {
    set({ rules: [], settings: DEFAULT_SETTINGS });
    get().persist();
  },

  persist: async () => {
    const { rules, settings } = get();
    await Promise.all([
      storage.set(STORAGE_KEYS.CAPTURE_RULES, rules),
      storage.set(STORAGE_KEYS.CAPTURE_SETTINGS, settings),
    ]);
  },
}));
