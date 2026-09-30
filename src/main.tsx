import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import ErrorBoundary from '@/components/ui/ErrorBoundary';
import { flushAllPersists } from '@/storage/persist-queue';
import { applyThemeClass, readStoredThemeMode, systemPrefersDark } from '@/theme/apply-theme';
import { resolveTheme } from '@/theme/theme';
import './index.css';

// 首屏防闪：渲染前先按已保存的外观同步切一次类名。
// 原生端的设置是异步读的，useThemeEffect 会在加载完之后再纠正一次。
applyThemeClass(resolveTheme(readStoredThemeMode(), systemPrefersDark()));

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