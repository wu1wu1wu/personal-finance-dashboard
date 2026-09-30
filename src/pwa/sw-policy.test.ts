import { describe, expect, it } from 'vitest';
import {
  SHELL_URLS,
  buildCacheName,
  decideCacheStrategy,
  isCacheableResponse,
  isNavigationRequest,
} from './sw-policy';
import type { RequestLike } from './sw-policy';

const ORIGIN = 'https://pfd.example.com';

function req(url: string, overrides: Partial<RequestLike> = {}): RequestLike {
  return {
    url: url.startsWith('http') ? url : `${ORIGIN}${url}`,
    method: 'GET',
    mode: 'cors',
    ...overrides,
  };
}

describe('decideCacheStrategy', () => {
  it('带 hash 的构建产物走缓存优先', () => {
    expect(decideCacheStrategy(req('/assets/index-a1b2c3.js'), ORIGIN)).toBe('cache-first');
    expect(decideCacheStrategy(req('/assets/index-a1b2c3.css'), ORIGIN)).toBe('cache-first');
  });

  it('页面导航走网络优先（否则用户永远看不到新版本）', () => {
    expect(decideCacheStrategy(req('/', { mode: 'navigate' }), ORIGIN)).toBe('network-first');
    expect(decideCacheStrategy(req('/report', { mode: 'navigate' }), ORIGIN)).toBe(
      'network-first',
    );
    expect(decideCacheStrategy(req('/index.html'), ORIGIN)).toBe('network-first');
  });

  it('图标与 manifest 走 stale-while-revalidate', () => {
    expect(decideCacheStrategy(req('/manifest.webmanifest'), ORIGIN)).toBe(
      'stale-while-revalidate',
    );
    expect(decideCacheStrategy(req('/icons/icon-192.png'), ORIGIN)).toBe(
      'stale-while-revalidate',
    );
  });

  it('跨域请求一律放行，不缓存', () => {
    expect(decideCacheStrategy(req('https://api.example.com/data'), ORIGIN)).toBe('bypass');
    expect(
      decideCacheStrategy({ url: 'https://cdn.example.com/assets/x.js', method: 'GET', mode: 'cors' }, ORIGIN),
    ).toBe('bypass');
  });

  it('非 GET 一律放行', () => {
    expect(decideCacheStrategy(req('/assets/x.js', { method: 'POST' }), ORIGIN)).toBe('bypass');
    expect(decideCacheStrategy(req('/transactions', { method: 'PUT' }), ORIGIN)).toBe('bypass');
  });

  it('未知路径不进缓存（比如 sw.js 自己必须是网络优先）', () => {
    expect(decideCacheStrategy(req('/sw.js'), ORIGIN)).toBe('bypass');
    expect(decideCacheStrategy(req('/some/other/thing.json'), ORIGIN)).toBe('bypass');
  });

  it('URL 解析不了时安全放行', () => {
    expect(decideCacheStrategy({ url: '::::', method: 'GET', mode: 'cors' }, ORIGIN)).toBe('bypass');
  });
});

describe('isNavigationRequest', () => {
  it('只有 navigate 算导航', () => {
    expect(isNavigationRequest(req('/', { mode: 'navigate' }))).toBe(true);
    expect(isNavigationRequest(req('/', { mode: 'cors' }))).toBe(false);
    expect(isNavigationRequest(req('/', { mode: 'no-cors' }))).toBe(false);
  });
});

describe('isCacheableResponse', () => {
  it('只缓存完整的 200', () => {
    expect(isCacheableResponse({ ok: true, status: 200 })).toBe(true);
    expect(isCacheableResponse({ ok: false, status: 404 })).toBe(false);
    expect(isCacheableResponse({ ok: true, status: 206 })).toBe(false);
    expect(isCacheableResponse({ ok: true, status: 200, type: 'opaque' })).toBe(false);
    expect(isCacheableResponse({ ok: true, status: 200, type: 'basic' })).toBe(true);
  });
});

describe('buildCacheName', () => {
  it('带上构建号', () => {
    expect(buildCacheName('abc123')).toBe('pfd-assets-abc123');
  });

  it('构建号缺失时也能用（开发和测试环境）', () => {
    expect(buildCacheName('')).toBe('pfd-assets-dev');
  });
});

describe('SHELL_URLS', () => {
  it('至少包含首页与图标，且都以 / 开头', () => {
    expect(SHELL_URLS).toContain('/');
    expect(SHELL_URLS).toContain('/index.html');
    expect(SHELL_URLS.some((url) => url.startsWith('/icons/'))).toBe(true);
    for (const url of SHELL_URLS) {
      expect(url.startsWith('/')).toBe(true);
    }
  });
});
