// ============================================================
// 应用设置 Store - 脱敏、外观、界面语言
//
// 之前 AppSettings 只是一个没人读写的死类型，脱敏在导入时无条件执行，
// 用户既看不到也关不掉。这里把它变成真的设置。
// ============================================================

import { create } from 'zustand';
import { STORAGE_KEYS } from '@/types';
import { storage } from '@/storage/StorageAdapter';
import { queuePersist } from '@/storage/persist-queue';
import { DEFAULT_LOCALE, detectBrowserLocale, normalizeLocale } from '@/i18n/locale';
import type { Locale } from '@/i18n/locale';
import { DEFAULT_THEME_MODE, normalizeThemeMode } from '@/theme/theme';
import type { ThemeMode } from '@/theme/theme';

export interface AppSettings {
  /** 导入账单时是否脱敏银行卡号/手机号/交易单号（默认开） */
  importDesensitize: boolean;
  /** 外观：跟随系统 / 强制浅色 / 强制深色 */
  themeMode: ThemeMode;
  /** 界面语言 */
  locale: Locale;
}

export const DEFAULT_SETTINGS: AppSettings = {
  importDesensitize: true,
  themeMode: DEFAULT_THEME_MODE,
  locale: DEFAULT_LOCALE,
};

/**
 * 老数据/坏数据兜底：字段类型不对就回到默认值。
 * 语言没存过（首次打开，或从没有语言设置的版本升级上来）时按浏览器语言猜一个。
 */
export function normalizeSettings(raw: unknown): AppSettings {
  if (typeof raw !== 'object' || raw === null) {
    return { ...DEFAULT_SETTINGS, locale: detectBrowserLocale() };
  }
  const value = (raw as { importDesensitize?: unknown }).importDesensitize;
  return {
    importDesensitize:
      typeof value === 'boolean' ? value : DEFAULT_SETTINGS.importDesensitize,
    themeMode: normalizeThemeMode((raw as { themeMode?: unknown }).themeMode),
    locale: normalizeLocale((raw as { locale?: unknown }).locale),
  };
}

interface SettingsStore {
  settings: AppSettings;
  loaded: boolean;

  loadFromStorage: () => Promise<void>;
  setImportDesensitize: (value: boolean) => void;
  setThemeMode: (mode: ThemeMode) => void;
  setLocale: (locale: Locale) => void;
  persist: () => Promise<void>;
}

export const useSettingsStore = create<SettingsStore>((set, get) => ({
  settings: DEFAULT_SETTINGS,
  loaded: false,

  loadFromStorage: async () => {
    if (get().loaded) return;
    const raw = await storage.get<unknown>(STORAGE_KEYS.SETTINGS);
    set({ settings: normalizeSettings(raw), loaded: true });
  },

  setImportDesensitize: (value) => {
    set((state) => ({ settings: { ...state.settings, importDesensitize: value } }));
    get().persist();
  },

  setThemeMode: (mode) => {
    set((state) => ({ settings: { ...state.settings, themeMode: mode } }));
    get().persist();
  },

  setLocale: (locale) => {
    set((state) => ({ settings: { ...state.settings, locale } }));
    get().persist();
  },

  persist: async () => {
    queuePersist('settings', async () => {
      await storage.set(STORAGE_KEYS.SETTINGS, get().settings);
    });
  },
}));
