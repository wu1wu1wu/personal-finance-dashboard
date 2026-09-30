// ============================================================
// PWA 注册与状态（更新提示 / 离线状态 / 安装）
//
// 纯状态模块：React 侧通过 subscribePwa + useSyncExternalStore 订阅。
// 不在原生 App 里注册 Service Worker —— Capacitor 的 WebView 本来就离线可用，
// 多一层缓存只会在发版时让人困惑。
// ============================================================

import { Capacitor } from '@capacitor/core';

export interface PwaState {
  /** Service Worker 注册成功 */
  registered: boolean;
  /** 新版本已就绪，等用户确认刷新 */
  updateReady: boolean;
  /** 当前断网 */
  offline: boolean;
  /** 浏览器允许「添加到主屏幕」 */
  canInstall: boolean;
}

/** 注册条件（纯函数，便于单测） */
export function shouldRegister(env: {
  isNative: boolean;
  hasServiceWorker: boolean;
  isDev: boolean;
}): boolean {
  // 原生 App 里不需要，开发期注册会把热更新后的旧代码缓存住
  if (env.isNative) return false;
  if (!env.hasServiceWorker) return false;
  return !env.isDev;
}

interface InstallPromptEvent extends Event {
  prompt(): Promise<void>;
}

let state: PwaState = {
  registered: false,
  updateReady: false,
  offline: false,
  canInstall: false,
};

const listeners = new Set<(state: PwaState) => void>();
let waitingWorker: ServiceWorker | null = null;
let installEvent: InstallPromptEvent | null = null;
let initialized = false;

export function getPwaState(): PwaState {
  return state;
}

export function subscribePwa(listener: (state: PwaState) => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function setState(patch: Partial<PwaState>): void {
  state = { ...state, ...patch };
  for (const listener of listeners) listener(state);
}

function watchForUpdate(registration: ServiceWorkerRegistration): void {
  // 上一次会话就装好、只是还没接管的那种
  if (registration.waiting && navigator.serviceWorker.controller) {
    waitingWorker = registration.waiting;
    setState({ updateReady: true });
  }

  registration.addEventListener('updatefound', () => {
    const installing = registration.installing;
    if (!installing) return;
    installing.addEventListener('statechange', () => {
      if (installing.state === 'installed' && navigator.serviceWorker.controller) {
        waitingWorker = registration.waiting ?? installing;
        setState({ updateReady: true });
      }
    });
  });
}

async function registerServiceWorker(): Promise<void> {
  try {
    const registration = await navigator.serviceWorker.register('/sw.js', { scope: '/' });
    setState({ registered: true });
    watchForUpdate(registration);
  } catch {
    // 注册失败不影响使用：没有离线缓存而已
  }
}

/** 初始化（幂等）。在 App 挂载时调用一次。 */
export function initPwa(): void {
  if (initialized) return;
  initialized = true;

  window.addEventListener('online', () => setState({ offline: false }));
  window.addEventListener('offline', () => setState({ offline: true }));
  setState({ offline: !navigator.onLine });

  window.addEventListener('beforeinstallprompt', (event) => {
    // 拦掉浏览器自带的小横幅，改成我们自己的入口
    event.preventDefault();
    installEvent = event as InstallPromptEvent;
    setState({ canInstall: true });
  });
  window.addEventListener('appinstalled', () => {
    installEvent = null;
    setState({ canInstall: false });
  });

  const should = shouldRegister({
    isNative: Capacitor.isNativePlatform(),
    hasServiceWorker: 'serviceWorker' in navigator,
    isDev: import.meta.env.DEV,
  });
  if (!should) return;

  // 等首屏渲染完再注册，别和首屏抢带宽
  if (document.readyState === 'complete') {
    void registerServiceWorker();
  } else {
    window.addEventListener('load', () => void registerServiceWorker(), { once: true });
  }
}

/** 让等待中的新版本接管并刷新页面 */
export function applyUpdate(): void {
  if (!waitingWorker) {
    window.location.reload();
    return;
  }
  navigator.serviceWorker.addEventListener('controllerchange', () => window.location.reload(), {
    once: true,
  });
  waitingWorker.postMessage({ type: 'SKIP_WAITING' });
}

/** 触发浏览器的「添加到主屏幕」 */
export async function installApp(): Promise<void> {
  if (!installEvent) return;
  const event = installEvent;
  installEvent = null;
  setState({ canInstall: false });
  await event.prompt();
}
