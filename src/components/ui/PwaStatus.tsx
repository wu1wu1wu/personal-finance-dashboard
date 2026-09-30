// ============================================================
// PwaStatus - 离线提示 / 新版本刷新 / 安装到桌面
//
// 三种提示互斥地占同一条底部位置，避免叠成两块浮层：
//   有新版本 > 可安装 > 什么都不显示
// 离线横幅走顶部（和存储告警同一区域），因为那是「当前状态」而不是「待办」。
// ============================================================

import { useState, useSyncExternalStore } from 'react';
import { Download, RefreshCw, WifiOff, X } from 'lucide-react';
import { applyUpdate, getPwaState, installApp, subscribePwa } from '@/pwa/register';
import { useT } from '@/i18n';

export default function PwaStatus() {
  const { t } = useT();
  const state = useSyncExternalStore(subscribePwa, getPwaState, getPwaState);
  const [updateDismissed, setUpdateDismissed] = useState(false);
  const [installDismissed, setInstallDismissed] = useState(false);

  const showUpdate = state.updateReady && !updateDismissed;
  const showInstall = !showUpdate && state.canInstall && !installDismissed;

  return (
    <>
      {state.offline && (
        <div
          role="status"
          className="flex items-center justify-center gap-1.5 border-b border-alert-soft bg-alert-soft px-4 py-2 text-xs text-alert"
        >
          <WifiOff size={13} aria-hidden="true" />
          {t('pwa.offline')}
        </div>
      )}

      {(showUpdate || showInstall) && (
        <div
          role="status"
          aria-live="polite"
          className="fixed inset-x-0 bottom-[calc(4.25rem+env(safe-area-inset-bottom))] z-40 px-4 md:bottom-4"
        >
          <div className="mx-auto flex max-w-md items-center gap-3 rounded-xl border border-line bg-surface p-3 shadow-lg">
            <span
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-brand-soft text-brand"
              aria-hidden="true"
            >
              {showUpdate ? <RefreshCw size={15} /> : <Download size={15} />}
            </span>

            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-ink">
                {showUpdate ? t('pwa.update.title') : t('pwa.install.title')}
              </p>
              <p className="mt-0.5 text-xs text-ink-subtle">
                {showUpdate ? t('pwa.update.description') : t('pwa.install.description')}
              </p>
            </div>

            <button
              type="button"
              onClick={() => {
                if (showUpdate) {
                  applyUpdate();
                } else {
                  void installApp();
                }
              }}
              className="flex min-h-11 shrink-0 items-center rounded-lg bg-brand px-3 text-sm font-medium text-white transition-colors hover:bg-brand/90"
            >
              {showUpdate ? t('pwa.update.action') : t('pwa.install.action')}
            </button>

            <button
              type="button"
              onClick={() => (showUpdate ? setUpdateDismissed(true) : setInstallDismissed(true))}
              aria-label={showUpdate ? t('pwa.update.dismiss') : t('pwa.install.dismiss')}
              className="flex min-h-11 min-w-11 shrink-0 items-center justify-center rounded-lg text-ink-subtle transition-colors hover:text-ink"
            >
              <X size={16} aria-hidden="true" />
            </button>
          </div>
        </div>
      )}
    </>
  );
}
