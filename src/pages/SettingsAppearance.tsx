// ============================================================
// SettingsAppearance - 外观（跟随系统 / 浅色 / 深色）
// ============================================================

import { Moon, Smartphone, Sun } from 'lucide-react';
import PageHeader from '@/components/ui/PageHeader';
import { useSettingsStore } from '@/stores/settings-store';
import { applyThemeClass, systemPrefersDark } from '@/theme/apply-theme';
import { resolveTheme } from '@/theme/theme';
import type { ThemeMode } from '@/theme/theme';
import { cn } from '@/utils/cn';

const OPTIONS: { value: ThemeMode; label: string; description: string; icon: typeof Sun }[] = [
  {
    value: 'system',
    label: '跟随系统',
    description: '系统切到深色时自动跟着变',
    icon: Smartphone,
  },
  { value: 'light', label: '浅色', description: '始终使用浅色配色', icon: Sun },
  { value: 'dark', label: '深色', description: '始终使用深色配色', icon: Moon },
];

export default function SettingsAppearance() {
  const themeMode = useSettingsStore((s) => s.settings.themeMode);
  const setThemeMode = useSettingsStore((s) => s.setThemeMode);

  const handleSelect = (mode: ThemeMode) => {
    setThemeMode(mode);
    // 立刻生效，不用等 effect 跑一轮
    applyThemeClass(resolveTheme(mode, systemPrefersDark()));
  };

  return (
    <div className="space-y-4">
      <PageHeader title="外观" description="选一套顺眼的配色，切换即时生效。" backTo="/settings" />

      <div
        role="radiogroup"
        aria-label="外观模式"
        className="overflow-hidden rounded-2xl border border-line bg-surface"
      >
        {OPTIONS.map((option, index) => {
          const active = option.value === themeMode;
          const Icon = option.icon;
          return (
            <button
              key={option.value}
              type="button"
              role="radio"
              aria-checked={active}
              onClick={() => handleSelect(option.value)}
              className={cn(
                'flex min-h-14 w-full items-center gap-3 px-4 py-3.5 text-left transition-colors',
                index > 0 && 'border-t border-line',
                active ? 'bg-brand-soft' : 'hover:bg-canvas',
              )}
            >
              <span
                className={cn(
                  'flex h-9 w-9 shrink-0 items-center justify-center rounded-lg',
                  active ? 'bg-brand text-white' : 'bg-canvas text-ink-muted',
                )}
                aria-hidden="true"
              >
                <Icon size={17} />
              </span>
              <span className="min-w-0 flex-1">
                <span
                  className={cn('block text-sm font-medium', active ? 'text-brand' : 'text-ink')}
                >
                  {option.label}
                </span>
                <span className="mt-0.5 block text-xs text-ink-subtle">{option.description}</span>
              </span>
            </button>
          );
        })}
      </div>

      <p className="px-1 text-xs text-ink-subtle">
        两套配色的对比度都按 WCAG AA 校过，深色下文字的对比度由单测守住。
      </p>
    </div>
  );
}
