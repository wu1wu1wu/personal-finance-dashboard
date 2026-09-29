// ============================================================
// ErrorBoundary - 渲染出错时的兜底页
//
// 纯本地应用最怕白屏：数据明明还在本机，用户却连"导出备份"都点不到。
// 这里保证任何渲染异常都还能导出一份数据再刷新。
// ============================================================

import { Component, type ErrorInfo, type ReactNode } from 'react';
import { buildBackup } from '@/core/backup';
import { storage } from '@/storage/StorageAdapter';
import { backupFilename, downloadJsonFile } from '@/utils/download';

interface Props {
  children: ReactNode;
}

interface State {
  error: Error | null;
  exportStatus: string | null;
}

export default class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null, exportStatus: null };

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('[ErrorBoundary] 页面渲染失败:', error, info.componentStack);
  }

  private handleExport = async () => {
    try {
      const backup = await buildBackup(storage);
      downloadJsonFile(backupFilename('记账备份_崩溃前'), backup);
      this.setState({ exportStatus: '已导出备份，可以放心刷新页面了' });
    } catch (e) {
      this.setState({
        exportStatus: `导出失败：${e instanceof Error ? e.message : '未知错误'}`,
      });
    }
  };

  render() {
    const { error, exportStatus } = this.state;
    if (!error) return this.props.children;

    return (
      <div className="mx-auto max-w-lg px-4 py-16">
        <div className="rounded-2xl border border-expense-soft bg-surface p-5">
          <h1 className="text-base font-semibold text-ink">页面出错了</h1>
          <p className="mt-2 text-sm leading-6 text-ink-muted">
            数据仍然保存在本机，没有丢失。建议先导出一份备份，再刷新页面重试。
          </p>
          <p className="mt-3 rounded-lg bg-canvas p-2.5 text-xs text-ink-subtle">
            {error.message || String(error)}
          </p>

          <div className="mt-4 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => void this.handleExport()}
              className="rounded-lg bg-brand px-4 py-2 text-sm font-medium text-white"
            >
              导出备份
            </button>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="rounded-lg border border-line px-4 py-2 text-sm font-medium text-ink"
            >
              刷新页面
            </button>
          </div>

          {exportStatus && (
            <p role="status" aria-live="polite" className="mt-3 text-sm text-income">
              {exportStatus}
            </p>
          )}
        </div>
      </div>
    );
  }
}
