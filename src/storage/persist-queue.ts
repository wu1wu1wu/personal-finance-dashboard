// ============================================================
// 持久化队列 - 让"写盘失败"这件事可见，并把高频写入合并
//
// 背景：Store 每次改动都会写一遍全量数据。写入失败（localStorage 配额超限、
// 原生 Preferences 异常）过去是 fire-and-forget 的 Promise，异常无人接管：
// 界面显示已保存、刷新后回退，用户毫不知情。这里做两件事：
//   1. 统一 try/catch，把失败原因挂到 usePersistStatus，由 UI 常驻提示；
//   2. 同一份数据的连续改动合并成一次写入，减少全量序列化。
// ============================================================

import { create } from 'zustand';

/** 同一份数据的改动在这个窗口内合并成一次写入 */
export const PERSIST_DEBOUNCE_MS = 200;

interface PersistStatus {
  /** 最近一次写入失败的原因；null 表示一切正常 */
  error: string | null;
  reportError: (message: string) => void;
  clearError: () => void;
}

export const usePersistStatus = create<PersistStatus>((set) => ({
  error: null,
  reportError: (message) => set({ error: message }),
  clearError: () => set({ error: null }),
}));

type Write = () => Promise<void>;

const pendingWrites = new Map<string, Write>();
const timers = new Map<string, ReturnType<typeof setTimeout>>();
/** 每个键串行执行，避免两次全量写入互相覆盖 */
const running = new Map<string, Promise<void>>();

/** 排队写入（默认防抖合并）；写失败只提示，不向调用方抛异常 */
export function queuePersist(key: string, write: Write, delay = PERSIST_DEBOUNCE_MS): void {
  pendingWrites.set(key, write);

  const timer = timers.get(key);
  if (timer !== undefined) clearTimeout(timer);
  timers.set(
    key,
    setTimeout(() => {
      void flushPersist(key);
    }, delay),
  );
}

/** 立刻写入某个键（没有待写入内容时是空操作） */
export function flushPersist(key: string): Promise<void> {
  const timer = timers.get(key);
  if (timer !== undefined) {
    clearTimeout(timer);
    timers.delete(key);
  }

  const write = pendingWrites.get(key);
  if (!write) return running.get(key) ?? Promise.resolve();
  pendingWrites.delete(key);

  const previous = running.get(key) ?? Promise.resolve();
  const next = previous.then(async () => {
    try {
      await write();
      usePersistStatus.getState().clearError();
    } catch (e) {
      // 配额超限、原生写入异常等：只提示，不抛出
      usePersistStatus.getState().reportError(e instanceof Error ? e.message : '数据保存失败');
    }
  });

  running.set(key, next);
  return next;
}

/** 写入所有待写入的键（页面隐藏/卸载前调用，避免防抖窗口里丢数据） */
export async function flushAllPersists(): Promise<void> {
  await Promise.all([...pendingWrites.keys()].map((key) => flushPersist(key)));
}
