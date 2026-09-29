import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import ErrorBoundary from '@/components/ui/ErrorBoundary';
import { flushAllPersists } from '@/storage/persist-queue';
import './index.css';

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