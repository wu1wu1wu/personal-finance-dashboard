import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { ChevronRight, Database, FolderOpen, Info, Smartphone, Tags } from 'lucide-react';
import { Capacitor } from '@capacitor/core';
import { useTransactionStore } from '@/stores/transaction-store';
import { useClassificationStore } from '@/stores/classification-store';
import { useBudgetStore } from '@/stores/budget-store';

interface MenuItem {
  to: string;
  label: string;
  description: string;
  icon: typeof FolderOpen;
  tone: string;
}

export default function Settings() {
  const { transactions, loadFromStorage: loadTransactions } = useTransactionStore();
  const { customRules, loadFromStorage: loadRules } = useClassificationStore();
  const { loadFromStorage: loadBudgets } = useBudgetStore();

  useEffect(() => {
    void loadTransactions();
    void loadRules();
    void loadBudgets();
  }, [loadTransactions, loadRules, loadBudgets]);

  const menuItems: MenuItem[] = [
    {
      to: '/settings/import',
      label: '账单导入',
      description: 'CSV / XLSX 账单文件',
      icon: FolderOpen,
      tone: 'bg-brand-soft text-brand',
    },
    {
      to: '/settings/auto-ledger',
      label: '自动记账',
      description: Capacitor.isNativePlatform()
        ? '权限、消息规则与诊断'
        : '仅安卓 App 支持',
      icon: Smartphone,
      tone: 'bg-income-soft text-income',
    },
    {
      to: '/settings/categories',
      label: '分类规则',
      description: `${customRules.length} 条自定义规则`,
      icon: Tags,
      tone: 'bg-canvas text-ink-muted',
    },
    {
      to: '/settings/data',
      label: '数据管理',
      description: `${transactions.length} 笔交易 · 备份与清理`,
      icon: Database,
      tone: 'bg-canvas text-ink-muted',
    },
    {
      to: '/settings/about',
      label: '关于',
      description: '隐私、备份和使用限制',
      icon: Info,
      tone: 'bg-canvas text-ink-muted',
    },
  ];

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold text-ink">设置</h1>

      <nav
        aria-label="设置菜单"
        className="overflow-hidden rounded-2xl border border-line bg-surface"
      >
        {menuItems.map((item, index) => (
          <Link
            key={item.to}
            to={item.to}
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
