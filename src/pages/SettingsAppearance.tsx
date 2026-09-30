// ============================================================
// SettingsAppearance - 外观（跟随系统 / 浅色 / 深色）+ 界面语言
// ============================================================

import { Check, Languages, Moon, Smartphone, Sun } from 'lucide-react';
import PageHeader from '@/components/ui/PageHeader';
import { LOCALES, LOCALE_LABELS, useT } from '@/i18n';
import type { Locale, MessageKey } from '@/i18n';
import { useSettingsStore } from '@/stores/settings-store';
import { applyThemeClass, systemPrefersDark } from '@/theme/apply-theme';
import { resolveTheme } from '@/theme/theme';
import type { ThemeMode } from '@/theme/theme';
import { cn } from '@/utils/cn';

const OPTIONS: {
  value: ThemeMode;
  labelKey: MessageKey;
  descriptionKey: MessageKey;
  icon: typeof Sun;
}[] = [
  {
    value: 'system',
    labelKey: 'theme.system.label',
    descriptionKey: 'theme.system.description',
    icon: Smartphone,
  },
  {
    value: 'light',
    labelKey: 'theme.light.label',
    descriptionKey: 'theme.light.description',
    icon: Sun,
  },
  {
    value: 'dark',
    labelKey: 'theme.dark.label',
    descriptionKey: 'theme.dark.description',
    icon: Moon,
  },
];

export default function SettingsAppearance() {
  const { t } = useT();
  const themeMode = useSettingsStore((s) => s.settings.themeMode);
  const setThemeMode = useSettingsStore((s) => s.setThemeMode);
  const locale = useSettingsStore((s) => s.settings.locale);
  const setLocale = useSettingsStore((s) => s.setLocale);

  const handleSelect = (mode: ThemeMode) => {
    setThemeMode(mode);
    // 立刻生效，不用等 effect 跑一轮
    applyThemeClass(resolveTheme(mode, systemPrefersDark()));
  };

  return (
    <div className="space-y-4">
      <PageHeader title={t('theme.title')} description={t('theme.description')} backTo="/settings" />

      <div
        role="radiogroup"
        aria-label={t('theme.modeLabel')}
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
                  {t(option.labelKey)}
                </span>
                <span className="mt-0.5 block text-xs text-ink-subtle">
                  {t(option.descriptionKey)}
                </span>
              </span>
            </button>
          );
        })}
      </div>

      <p className="px-1 text-xs text-ink-subtle">{t('theme.contrastNote')}</p>

      {/* 语言 */}
      <div className="space-y-2 pt-2">
        <div className="px-1">
          <h2 className="text-sm font-medium text-ink">{t('theme.language.title')}</h2>
          <p className="mt-0.5 text-xs text-ink-subtle">{t('theme.language.description')}</p>
        </div>

        <div
          role="radiogroup"
          aria-label={t('theme.language.label')}
          className="overflow-hidden rounded-2xl border border-line bg-surface"
        >
          {LOCALES.map((option: Locale, index) => {
            const active = option === locale;
            return (
              <button
                key={option}
                type="button"
                role="radio"
                aria-checked={active}
                onClick={() => setLocale(option)}
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
                  <Languages size={17} />
                </span>
                <span
                  className={cn(
                    'min-w-0 flex-1 text-sm font-medium',
                    active ? 'text-brand' : 'text-ink',
                  )}
                >
                  {LOCALE_LABELS[option]}
                </span>
                {active && <Check size={18} className="shrink-0 text-brand" aria-hidden="true" />}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
