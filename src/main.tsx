import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import ErrorBoundary from '@/components/ui/ErrorBoundary';
import { consumeBack } from '@/core/back-stack';
import { flushAllPersists } from '@/storage/persist-queue';
import { applyThemeClass, readStoredThemeMode, systemPrefersDark } from '@/theme/apply-theme';
import { resolveTheme } from '@/theme/theme';
import './index.css';

// 首屏防闪：渲染前先按已保存的外观同步切一次类名。
// 原生端的设置是异步读的，useThemeEffect 会在加载完之后再纠正一次。
applyThemeClass(resolveTheme(readStoredThemeMode(), systemPrefersDark()));

// 安卓返回键：Capacitor 8 不再处理，MainActivity 按下返回时会执行这个函数。
// 有弹窗/抽屉要吃这次返回就回 true，原生据此不动；否则原生退回 WebView 历史，
// 历史到底才退出 App——修掉「在设置子页或详情弹窗里按返回直接退出」的问题。
window.__pfdHandleBack = consumeBack;

// 写入是防抖合并的：页面隐藏/关闭前把待写入内容刷干净，别把最后一步改动留在内存里
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'hidden') void flushAllPersists();
});
window.addEventListener('pagehide', () => {
  void flushAllPersists();
});

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>,
);