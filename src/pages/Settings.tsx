import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { ChevronRight, Database, FolderOpen, Info, Smartphone, SunMoon, Tags } from 'lucide-react';
import { Capacitor } from '@capacitor/core';
import { useT } from '@/i18n';
import type { MessageKey } from '@/i18n';
import type { BackFromState } from '@/hooks/useBackTo';
import { useTransactionStore } from '@/stores/transaction-store';
import { useClassificationStore } from '@/stores/classification-store';
import { useBudgetStore } from '@/stores/budget-store';
import { useSettingsStore } from '@/stores/settings-store';

/** 外观项的副标题直接用外观页的档位名，回落到「跟随系统」 */
const THEME_LABEL_KEYS: Record<string, MessageKey> = {
  system: 'theme.system.label',
  light: 'theme.light.label',
  dark: 'theme.dark.label',
};

interface MenuItem {
  to: string;
  label: string;
  description: string;
  icon: typeof FolderOpen;
  tone: string;
}

export default function Settings() {
  const { t } = useT();
  const { transactions, loadFromStorage: loadTransactions } = useTransactionStore();
  const { customRules, loadFromStorage: loadRules } = useClassificationStore();
  const { loadFromStorage: loadBudgets } = useBudgetStore();
  const themeMode = useSettingsStore((s) => s.settings.themeMode);

  useEffect(() => {
    void loadTransactions();
    void loadRules();
    void loadBudgets();
  }, [loadTransactions, loadRules, loadBudgets]);

  const menuItems: MenuItem[] = [
    {
      to: '/settings/import',
      label: t('billImport.title'),
      description: t('settings.menu.importDescription'),
      icon: FolderOpen,
      tone: 'bg-brand-soft text-brand',
    },
    {
      to: '/settings/appearance',
      label: t('theme.title'),
      description: t(THEME_LABEL_KEYS[themeMode] ?? 'theme.system.label'),
      icon: SunMoon,
      tone: 'bg-canvas text-ink-muted',
    },
    {
      to: '/settings/auto-ledger',
      label: t('settings.menu.autoLedger'),
      description: Capacitor.isNativePlatform()
        ? t('settings.menu.autoLedgerDescription')
        : t('settings.menu.autoLedgerUnsupported'),
      icon: Smartphone,
      tone: 'bg-income-soft text-income',
    },
    {
      to: '/settings/categories',
      label: t('settingsRules.title'),
      description: t('settings.menu.rulesCount', { count: customRules.length }),
      icon: Tags,
      tone: 'bg-canvas text-ink-muted',
    },
    {
      to: '/settings/data',
      label: t('settingsData.title'),
      description: t('settings.menu.dataDescription', { count: transactions.length }),
      icon: Database,
      tone: 'bg-canvas text-ink-muted',
    },
    {
      to: '/settings/about',
      label: t('settings.about.title'),
      description: t('settings.menu.aboutDescription'),
      icon: Info,
      tone: 'bg-canvas text-ink-muted',
    },
  ];

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold text-ink">{t('settings.title')}</h1>

      <nav
        aria-label={t('settings.menuLabel')}
        className="overflow-hidden rounded-2xl border border-line bg-surface"
      >
        {menuItems.map((item, index) => (
          <Link
            key={item.to}
            to={item.to}
            state={{ from: '/settings' } satisfies BackFromState}
            className={`flex items-center gap-3 px-4 py-3.5 transition-colors hover:bg-canvas ${
              index > 0 ? 'border-t border-line' : ''
            }`}
          >
            <span
              className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${item.tone}`}
              aria-hidden="true"
            >
              <item.icon size={18} />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-medium text-ink">{item.label}</span>
              <span className="mt-0.5 block truncate text-xs text-ink-subtle">
                {item.description}
              </span>
            </span>
            <ChevronRight size={17} className="shrink-0 text-ink-subtle" aria-hidden="true" />
          </Link>
        ))}
      </nav>
    </div>
  );
}
