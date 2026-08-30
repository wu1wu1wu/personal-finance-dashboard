// ============================================================
// 存储抽象层 - 无缝切换 localStorage（Web） / Capacitor Preferences（原生 App）
// ============================================================

import { Capacitor } from '@capacitor/core';
import { Preferences } from '@capacitor/preferences';

/** 存储适配器接口 */
export interface StorageAdapter {
  /** 读取数据 */
  get<T>(key: string): Promise<T | null>;
  /** 写入数据 */
  set<T>(key: string, value: T): Promise<void>;
  /** 删除数据 */
  remove(key: string): Promise<void>;
  /** 清空所有数据 */
  clear(): Promise<void>;
  /** 获取所有键 */
  keys(): Promise<string[]>;
}

/** LocalStorage 适配器实现（Web 端） */
export class LocalStorageAdapter implements StorageAdapter {
  async get<T>(key: string): Promise<T | null> {
    try {
      const raw = localStorage.getItem(key);
      if (raw === null) return null;
      return JSON.parse(raw) as T;
    } catch {
      console.warn(`[Storage] Failed to parse key: ${key}`);
      return null;
    }
  }

  async set<T>(key: string, value: T): Promise<void> {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch (e) {
      console.error(`[Storage] Failed to set key: ${key}`, e);
      throw new Error('存储空间不足，请清理数据或导出备份');
    }
  }

  async remove(key: string): Promise<void> {
    localStorage.removeItem(key);
  }

  async clear(): Promise<void> {
    // 只清除 pfd_ 前缀的数据，避免影响其他应用
    const keys = await this.keys();
    keys.forEach((k) => localStorage.removeItem(k));
  }

  async keys(): Promise<string[]> {
    return Object.keys(localStorage).filter((k) => k.startsWith('pfd_'));
  }
}

/**
 * Capacitor Preferences 适配器实现（原生 App 端）
 * 底层为 Android SharedPreferences，数据落盘在 App 数据目录，不会被系统/浏览器回收
 */
export class CapacitorPreferencesAdapter implements StorageAdapter {
  async get<T>(key: string): Promise<T | null> {
    const { value } = await Preferences.get({ key });
    if (value === null) return null;
    try {
      return JSON.parse(value) as T;
    } catch {
      console.warn(`[Preferences] Failed to parse key: ${key}`);
      return null;
    }
  }

  async set<T>(key: string, value: T): Promise<void> {
    await Preferences.set({ key, value: JSON.stringify(value) });
  }

  async remove(key: string): Promise<void> {
    await Preferences.remove({ key });
  }

  async clear(): Promise<void> {
    // 只清除 pfd_ 前缀的数据
    const { keys } = await Preferences.keys();
    for (const k of keys) {
      if (k.startsWith('pfd_')) {
        await Preferences.remove({ key: k });
      }
    }
  }

  async keys(): Promise<string[]> {
    const { keys } = await Preferences.keys();
    return keys.filter((k) => k.startsWith('pfd_'));
  }
}

/** 全局存储实例（单例）：原生 App 用 Preferences，Web 端用 localStorage */
export const storage: StorageAdapter = Capacitor.isNativePlatform()
  ? new CapacitorPreferencesAdapter()
  : new LocalStorageAdapter();
