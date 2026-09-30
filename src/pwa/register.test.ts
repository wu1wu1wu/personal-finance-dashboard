import { describe, expect, it } from 'vitest';
import { getPwaState, shouldRegister } from './register';

describe('shouldRegister', () => {
  it('普通浏览器里注册', () => {
    expect(
      shouldRegister({ isNative: false, hasServiceWorker: true, isDev: false }),
    ).toBe(true);
  });

  it('原生 App 里不注册（WebView 本来就离线可用）', () => {
    expect(shouldRegister({ isNative: true, hasServiceWorker: true, isDev: false })).toBe(false);
  });

  it('开发期不注册，免得缓存住旧代码', () => {
    expect(shouldRegister({ isNative: false, hasServiceWorker: true, isDev: true })).toBe(false);
  });

  it('浏览器不支持时不注册', () => {
    expect(shouldRegister({ isNative: false, hasServiceWorker: false, isDev: false })).toBe(
      false,
    );
  });
});

describe('PwaState 默认值', () => {
  it('初始状态是「没注册、没更新、没安装提示」，离线取当前网络状态', () => {
    // node 环境没有 navigator.onLine，这里只校验结构与类型
    const state = getPwaState();
    expect(state.registered).toBe(false);
    expect(state.updateReady).toBe(false);
    expect(state.canInstall).toBe(false);
    expect(typeof state.offline).toBe('boolean');
  });
});
