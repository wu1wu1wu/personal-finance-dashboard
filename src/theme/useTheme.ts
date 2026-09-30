// ============================================================
// useThemeEffect - 把设置里的外观模式落到 <html> 上
//
// 在 App 顶层挂载一次。首屏那一次在 main.tsx 里同步做过（防闪），
// 这里负责后续变化，以及「跟随系统」时监听系统主题切换。
// ============================================================

import { useEffect } from 'react';
import { useSettingsStore } from '@/stores/settings-store';
import { applyThemeClass, systemPrefersDark, watchSystemTheme } from '@/theme/apply-theme';
import { resolveTheme } from '@/theme/theme';

export function useThemeEffect(): void {
  const themeMode = useSettingsStore((s) => s.settings.themeMode);
  const loaded = useSettingsStore((s) => s.loaded);
  const loadFromStorage = useSettingsStore((s) => s.loadFromStorage);

  // 原生端的设置是异步读出来的，加载完再应用一次，纠正首屏的猜测
  useEffect(() => {
    void loadFromStorage();
  }, [loadFromStorage]);

  useEffect(() => {
    applyThemeClass(resolveTheme(themeMode, systemPrefersDark()));

    if (themeMode !== 'system') return;
    return watchSystemTheme((prefersDark) => {
      applyThemeClass(resolveTheme('system', prefersDark));
    });
  }, [themeMode, loaded]);
}
