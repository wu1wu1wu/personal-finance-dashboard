// ============================================================
// PageFallback - 路由懒加载时的占位骨架
//
// 页面是动态 import 的，切换路由的瞬间需要占位。
// 高度按页面的常见体量给足，避免加载完成后整体跳一下。
// ============================================================

import { useT } from '@/i18n';

export default function PageFallback() {
  const { t } = useT();

  return (
    <div role="status" aria-live="polite" className="space-y-4">
      <span className="sr-only">{t('common.loading')}</span>
      <div className="h-7 w-24 animate-pulse rounded-lg bg-line" aria-hidden="true" />
      <div className="h-32 animate-pulse rounded-2xl bg-line/60" aria-hidden="true" />
      <div className="h-24 animate-pulse rounded-2xl bg-line/60" aria-hidden="true" />
    </div>
  );
}
