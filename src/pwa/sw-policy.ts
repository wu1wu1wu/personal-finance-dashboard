// ============================================================
// Service Worker 缓存策略（纯函数）
//
// 单独放一个文件是为了能单测：sw.ts 里全是 self / fetch 这类全局对象，
// 在 node 环境跑不起来，但「这条请求该走哪种缓存策略」是可以纯算的。
// sw.ts 直接 import 这里的实现，测试与线上跑的是同一份代码。
// ============================================================

/** 缓存策略 */
export type CacheStrategy =
  /** 先联网，失败回缓存（导航请求用：保证用户拿到最新页面） */
  | 'network-first'
  /** 先缓存，命中就返回（带 hash 的静态资源用：内容永不变） */
  | 'cache-first'
  /** 先回缓存再后台更新（图标/manifest 这类小文件用） */
  | 'stale-while-revalidate'
  /** 不进缓存，直接交给浏览器 */
  | 'bypass';

/** 请求里我们关心的字段（Request 的投影，方便测试） */
export interface RequestLike {
  url: string;
  method: string;
  /** 'navigate' 表示地址栏/链接直接打开页面 */
  mode: string;
}

/**
 * 预缓存清单：至少保证离线打开能看到界面。
 * 带 hash 的 JS/CSS 不写死在这里（构建产物名每次都会变），
 * 它们会在首次访问时按 cache-first 落到运行时缓存里。
 */
export const SHELL_URLS = [
  '/',
  '/index.html',
  '/manifest.webmanifest',
  '/favicon.svg',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
];

/** 图标、manifest 这类很少变的小文件 */
const STALE_WHILE_REVALIDATE_PATHS = new Set([
  '/manifest.webmanifest',
  '/favicon.svg',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
  '/icons/icon-maskable-512.png',
  '/icons/apple-touch-icon.png',
]);

/** 缓存名带构建号：发新版就换一个，旧缓存 activate 时清掉 */
export function buildCacheName(buildId: string): string {
  return `pfd-assets-${buildId || 'dev'}`;
}

/** 导航请求：地址栏打开、点链接跳转、刷新 */
export function isNavigationRequest(request: RequestLike): boolean {
  return request.mode === 'navigate';
}

/**
 * 决定一条请求走哪种策略。
 *
 * 只处理同源 GET：跨域（比如以后要接的接口）与非 GET 一律放行，
 * 免得把登录态、POST 请求缓存出奇怪的问题。
 */
export function decideCacheStrategy(request: RequestLike, selfOrigin: string): CacheStrategy {
  if (request.method !== 'GET') return 'bypass';

  let url: URL;
  try {
    url = new URL(request.url);
  } catch {
    return 'bypass';
  }

  if (url.origin !== selfOrigin) return 'bypass';

  const path = url.pathname;

  // 带内容 hash 的构建产物：命中缓存直接返回，不用每次都问服务器
  if (path.startsWith('/assets/')) return 'cache-first';

  // 页面：必须联网优先，否则用户永远看不到新版本
  if (isNavigationRequest(request)) return 'network-first';
  if (path === '/' || path.endsWith('.html')) return 'network-first';

  if (STALE_WHILE_REVALIDATE_PATHS.has(path)) return 'stale-while-revalidate';

  // 其余同源 GET（包含 sw.js 自己、未知路径）不进缓存
  return 'bypass';
}

/**
 * 能不能缓存这条响应。
 * 只缓存完整的 200：206 是分段内容、opaque 是跨域不透明响应（拿不到内容也判断不了）。
 */
export function isCacheableResponse(response: {
  ok: boolean;
  status: number;
  type?: string;
}): boolean {
  if (!response.ok || response.status !== 200) return false;
  if (response.type === 'opaque' || response.type === 'opaqueredirect') return false;
  return true;
}
