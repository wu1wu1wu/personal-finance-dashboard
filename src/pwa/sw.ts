// ============================================================
// Service Worker - 离线可用 + 版本更新
//
// 这个文件会被 Vite 当成第二个入口打成 dist/sw.js（见 vite.config.ts）。
// 缓存策略本身在 sw-policy.ts 里（纯函数、有单测），这里只做接线。
// ============================================================

import {
  SHELL_URLS,
  buildCacheName,
  decideCacheStrategy,
  isCacheableResponse,
} from './sw-policy';
import type { CacheStrategy } from './sw-policy';

interface ExtendableEventLike {
  waitUntil(promise: Promise<unknown>): void;
}

interface FetchEventLike extends ExtendableEventLike {
  request: Request;
  respondWith(response: Promise<Response>): void;
}

/** Service Worker 全局对象里我们真正用到的部分（DOM lib 没有这层类型） */
interface SwScope {
  addEventListener(type: 'install', handler: (event: ExtendableEventLike) => void): void;
  addEventListener(type: 'activate', handler: (event: ExtendableEventLike) => void): void;
  addEventListener(type: 'fetch', handler: (event: FetchEventLike) => void): void;
  addEventListener(type: 'message', handler: (event: { data: unknown }) => void): void;
  skipWaiting(): Promise<void>;
  clients: { claim(): Promise<void> };
  location: { origin: string };
}

const sw = globalThis as unknown as SwScope;

/** 缓存名带构建号：发新版就换一个，旧缓存 activate 时统一清掉 */
const CACHE_NAME = buildCacheName(__BUILD_ID__);

/** 磁盘写缓存失败不影响这次请求，但别把未处理的 Promise 丢出去 */
function putQuietly(cache: Cache, request: Request, response: Response): void {
  void cache.put(request, response).catch(() => undefined);
}

async function precache(): Promise<void> {
  const cache = await caches.open(CACHE_NAME);
  // 单个文件拿不到不能让整个安装失败（例如某个图标还没部署）
  await Promise.all(
    SHELL_URLS.map(async (url) => {
      try {
        await cache.add(new Request(url, { cache: 'reload' }));
      } catch {
        // 忽略：能缓存多少算多少
      }
    }),
  );
}

async function handleFetch(request: Request, strategy: CacheStrategy): Promise<Response> {
  const cache = await caches.open(CACHE_NAME);

  if (strategy === 'cache-first') {
    const cached = await cache.match(request);
    if (cached) return cached;
    const response = await fetch(request);
    if (isCacheableResponse(response)) putQuietly(cache, request, response.clone());
    return response;
  }

  if (strategy === 'stale-while-revalidate') {
    const cached = await cache.match(request);
    const network = fetch(request)
      .then((response) => {
        if (isCacheableResponse(response)) putQuietly(cache, request, response.clone());
        return response;
      })
      .catch(() => undefined);

    if (cached) return cached;

    const response = await network;
    if (response) return response;
    throw new Error('offline: no cache');
  }

  // network-first
  try {
    const response = await fetch(request);
    if (isCacheableResponse(response)) putQuietly(cache, request, response.clone());
    return response;
  } catch (error) {
    // 离线时页面请求回落到壳；SPA 路由（/report 等）也能打开
    const fallback =
      (await cache.match(request)) ??
      (request.mode === 'navigate' ? await cache.match('/index.html') : undefined);
    if (fallback) return fallback;
    throw error;
  }
}

sw.addEventListener('install', (event) => {
  event.waitUntil(precache());
});

sw.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const names = await caches.keys();
      await Promise.all(
        names
          .filter((name) => name.startsWith('pfd-assets-') && name !== CACHE_NAME)
          .map((name) => caches.delete(name)),
      );
      await sw.clients.claim();
    })(),
  );
});

sw.addEventListener('fetch', (event) => {
  const strategy = decideCacheStrategy(
    {
      url: event.request.url,
      method: event.request.method,
      mode: event.request.mode,
    },
    sw.location.origin,
  );

  if (strategy === 'bypass') return;
  event.respondWith(handleFetch(event.request, strategy));
});

sw.addEventListener('message', (event) => {
  // 页面点「立即刷新」时让新版本立刻接管
  const data = event.data as { type?: string } | null;
  if (data?.type === 'SKIP_WAITING') void sw.skipWaiting();
});
