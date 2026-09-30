// ============================================================
// ErrorBoundary - 渲染出错时的兜底页
//
// 纯本地应用最怕白屏：数据明明还在本机，用户却连"导出备份"都点不到。
// 这里保证任何渲染异常都还能导出一份数据再刷新。
//
// 类组件用不了 hook，所以文案与渲染都放在函数组件 ErrorFallback 里，
// 类只负责状态与副作用。
// ============================================================

import { Component, type ErrorInfo, type ReactNode } from 'react';
import { buildBackup } from '@/core/backup';
import { translateIn } from '@/i18n/translate';
import type { MessageKey, TranslateParams } from '@/i18n';
import { useT } from '@/i18n';
import { useSettingsStore } from '@/stores/settings-store';
import { storage } from '@/storage/StorageAdapter';
import { backupFilename, downloadJsonFile } from '@/utils/download';

interface Props {
  children: ReactNode;
}

/** 提示文案以 key + 参数的形式存着，渲染时按当前语言翻译 */
interface StatusMessage {
  key: MessageKey;
  params?: TranslateParams;
}

interface State {
  error: Error | null;
  exportStatus: StatusMessage | null;
}

/** 兜底页本体（函数组件，才能用 useT） */
function ErrorFallback({
  message,
  status,
  onExport,
  onReload,
}: {
  message: string;
  status: StatusMessage | null;
  onExport: () => void;
  onReload: () => void;
}) {
  const { t } = useT();

  return (
    <div className="mx-auto max-w-lg px-4 py-16">
      <div className="rounded-2xl border border-expense-soft bg-surface p-5">
        <h1 className="text-base font-semibold text-ink">{t('common.error.title')}</h1>
        <p className="mt-2 text-sm leading-6 text-ink-muted">
          {t('common.error.description')}
        </p>
        <p className="mt-3 rounded-lg bg-canvas p-2.5 text-xs text-ink-subtle">{message}</p>

        <div className="mt-4 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={onExport}
            className="rounded-lg bg-brand px-4 py-2 text-sm font-medium text-white"
          >
            {t('common.error.export')}
          </button>
          <button
            type="button"
            onClick={onReload}
            className="rounded-lg border border-line px-4 py-2 text-sm font-medium text-ink"
          >
            {t('common.error.reload')}
          </button>
        </div>

        {status && (
          <p role="status" aria-live="polite" className="mt-3 text-sm text-income">
            {t(status.key, status.params)}
          </p>
        )}
      </div>
    </div>
  );
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
    // 崩溃时设置可能还没加载完，兜底读一次 store 里的语言（读不到就是默认中文）
    const locale = useSettingsStore.getState().settings.locale;

    try {
      const backup = await buildBackup(storage);
      downloadJsonFile(
        backupFilename(translateIn(locale, 'common.error.backupFileName')),
        backup,
      );
      this.setState({ exportStatus: { key: 'common.error.exported' } });
    } catch (e) {
      this.setState({
        exportStatus: {
          key: 'common.error.exportFailed',
          params: {
            message:
              e instanceof Error ? e.message : translateIn(locale, 'common.error.unknown'),
          },
        },
      });
    }
  };

  render() {
    const { error, exportStatus } = this.state;
    if (!error) return this.props.children;

    return (
      <ErrorFallback
        message={error.message || String(error)}
        status={exportStatus}
        onExport={() => void this.handleExport()}
        onReload={() => window.location.reload()}
      />
    );
  }
}
