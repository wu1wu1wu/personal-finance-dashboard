// ============================================================
// 周期扣款提醒 Store - 记录用户「不想再被提醒」的商户
//
// 只存商户名（counterparty）：周期识别的键就是它，
// 忽略之后既不出现在提醒卡片里，也不影响明细与统计。
// ============================================================

import { create } from 'zustand';
import { STORAGE_KEYS } from '@/types';
import { storage } from '@/storage/StorageAdapter';
import { queuePersist } from '@/storage/persist-queue';

/** 读取时兜底：坏数据、重复项、空串都清掉 */
export function normalizeIgnored(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];

  const seen = new Set<string>();
  const result: string[] = [];
  for (const item of raw) {
    if (typeof item !== 'string') continue;
    const value = item.trim();
    if (!value || seen.has(value)) continue;
    seen.add(value);
    result.push(value);
  }
  return result;
}

interface RecurringStore {
  /** 已忽略的商户名 */
  ignored: string[];
  loaded: boolean;

  loadFromStorage: () => Promise<void>;
  ignore: (counterparty: string) => void;
  restore: (counterparty: string) => void;
  clearIgnored: () => void;
  persist: () => Promise<void>;
}

export const useRecurringStore = create<RecurringStore>((set, get) => ({
  ignored: [],
  loaded: false,

  loadFromStorage: async () => {
    if (get().loaded) return;
    const raw = await storage.get<unknown>(STORAGE_KEYS.RECURRING_IGNORED);
    set({ ignored: normalizeIgnored(raw), loaded: true });
  },

  ignore: (counterparty) => {
    const value = counterparty.trim();
    if (!value || get().ignored.includes(value)) return;
    set((state) => ({ ignored: [...state.ignored, value] }));
    get().persist();
  },

  restore: (counterparty) => {
    set((state) => ({ ignored: state.ignored.filter((name) => name !== counterparty) }));
    get().persist();
  },

  clearIgnored: () => {
    set({ ignored: [] });
    get().persist();
  },

  persist: async () => {
    queuePersist('recurring', async () => {
      await storage.set(STORAGE_KEYS.RECURRING_IGNORED, get().ignored);
    });
  },
}));
