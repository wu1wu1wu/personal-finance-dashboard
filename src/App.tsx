import { lazy, Suspense, useEffect, useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import {
  FileText,
  LayoutDashboard,
  Plus,
  ReceiptText,
  Wallet,
  Settings as SettingsIcon,
} from 'lucide-react';
import AddTransactionModal from '@/components/transactions/AddTransactionModal';
import NavItem from '@/components/ui/NavItem';
import PageFallback from '@/components/ui/PageFallback';
import PersistAlert from '@/components/ui/PersistAlert';
import PwaStatus from '@/components/ui/PwaStatus';
import { useAutoLedger } from '@/hooks/useAutoLedger';
import { useLocaleEffect, useT } from '@/i18n';
import type { MessageKey } from '@/i18n';
import { initPwa } from '@/pwa/register';
import { useThemeEffect } from '@/theme/useTheme';

// 页面按路由懒加载：图表（echarts）和 Excel 解析（xlsx）都不会进首屏 chunk，
// 设置、明细、预算这些页也不用为此付下载与解析的代价。
const Dashboard = lazy(() => import('@/pages/Dashboard'));
const Transactions = lazy(() => import('@/pages/Transactions'));
const Budget = lazy(() => import('@/pages/Budget'));
const Settings = lazy(() => import('@/pages/Settings'));
const SettingsAbout = lazy(() => import('@/pages/SettingsAbout'));
const SettingsAutoLedger = lazy(() => import('@/pages/SettingsAutoLedger'));
const SettingsCategories = lazy(() => import('@/pages/SettingsCategories'));
const SettingsData = lazy(() => import('@/pages/SettingsData'));
const SettingsImport = lazy(() => import('@/pages/SettingsImport'));
const SettingsAppearance = lazy(() => import('@/pages/SettingsAppearance'));
const Report = lazy(() => import('@/pages/Report'));
const Cleanup = lazy(() => import('@/pages/Cleanup'));

const navItems: { to: string; labelKey: MessageKey; icon: typeof LayoutDashboard }[] = [
  { to: '/', labelKey: 'nav.dashboard', icon: LayoutDashboard },
  { to: '/transactions', labelKey: 'nav.transactions', icon: ReceiptText },
  { to: '/budget', labelKey: 'nav.budget', icon: Wallet },
  { to: '/settings', labelKey: 'nav.settings', icon: SettingsIcon },
];

export default function App() {
  useAutoLedger();
  useThemeEffect();
  useLocaleEffect();
  const { t } = useT();
  const [showAddModal, setShowAddModal] = useState(false);

  // Service Worker 只注册一次：生产环境的浏览器里才有效，原生 App 与开发期会自己跳过
  useEffect(() => {
    initPwa();
  }, []);

  return (
    <BrowserRouter>
      <div className="min-h-screen bg-canvas">
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-50 focus:rounded-lg focus:bg-brand focus:px-3 focus:py-2 focus:text-sm focus:text-white"
        >
          {t('nav.skipToMain')}
        </a>
        {/* 存储写失败时的常驻告警：数据没落盘必须让用户看到 */}
        <PersistAlert />

        {/* 离线提示 / 新版本刷新 / 安装到桌面 */}
        <PwaStatus />

        {/* 顶部导航（桌面端） */}
        <nav className="sticky top-0 z-30 hidden border-b border-line bg-surface md:block">
          <div className="mx-auto flex h-14 max-w-5xl items-center gap-1 px-4">
            <span className="mr-4 text-base font-semibold tracking-tight text-ink">
              {t('common.appName')}
            </span>
            {navItems.map((item) => (
              <NavItem
                key={item.to}
                to={item.to}
                end={item.to === '/'}
                label={t(item.labelKey)}
                icon={<item.icon size={16} aria-hidden="true" />}
                className={(isActive) =>
                  `flex min-h-11 items-center gap-1.5 rounded-lg px-3 text-sm font-medium transition-colors ${
                    isActive
                      ? 'bg-brand-soft text-brand'
                      : 'text-ink-muted hover:bg-canvas hover:text-ink'
                  }`
                }
              />
            ))}

            {/* 报告只在桌面端导航里露出来：移动端底部栏只有四个位置，
                报告从看板的入口卡片进 */}
            <NavItem
              to="/report"
              label={t('nav.report')}
              icon={<FileText size={16} aria-hidden="true" />}
              className={(isActive) =>
                `hidden min-h-11 items-center gap-1.5 rounded-lg px-3 text-sm font-medium transition-colors md:flex ${
                  isActive ? 'bg-brand-soft text-brand' : 'text-ink-muted hover:bg-canvas hover:text-ink'
                }`
              }
            />

            <button
              type="button"
              onClick={() => setShowAddModal(true)}
              className="ml-auto flex min-h-11 items-center gap-1.5 rounded-lg bg-brand px-3 text-sm font-medium text-white transition-colors hover:bg-brand/90"
            >
              <Plus size={16} aria-hidden="true" />
              {t('nav.add')}
            </button>
          </div>
        </nav>

        {/* 页面内容 */}
        <main id="main" className="mx-auto max-w-5xl px-4 pb-28 pt-4 md:pb-10">
          <Suspense fallback={<PageFallback />}>
            <Routes>
              <Route path="/" element={<Dashboard />} />
              <Route path="/transactions" element={<Transactions />} />
              <Route path="/budget" element={<Budget />} />
              <Route path="/report" element={<Report />} />
              <Route path="/settings" element={<Settings />} />
              <Route path="/settings/import" element={<SettingsImport />} />
              <Route path="/settings/appearance" element={<SettingsAppearance />} />
              <Route path="/settings/auto-ledger" element={<SettingsAutoLedger />} />
              <Route path="/settings/categories" element={<SettingsCategories />} />
              <Route path="/settings/data" element={<SettingsData />} />
              <Route path="/settings/about" element={<SettingsAbout />} />
              <Route path="/cleanup" element={<Cleanup />} />
              {/* 未知路径回看板，别留给用户一片空白 */}
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </Suspense>
        </main>

        {/* 底部导航（移动端） */}
        <nav
          aria-label={t('nav.primary')}
          className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-surface pb-[env(safe-area-inset-bottom)] md:hidden"
        >
          <div className="flex items-stretch">
            {navItems.slice(0, 2).map((item) => (
              <NavItem
                key={item.to}
                to={item.to}
                end={item.to === '/'}
                label={t(item.labelKey)}
                icon={<item.icon size={21} strokeWidth={2} aria-hidden="true" />}
                className={(isActive) =>
                  `flex flex-1 flex-col items-center justify-center gap-1 py-2.5 text-[11px] font-medium transition-colors ${
                    isActive ? 'text-brand' : 'text-ink-subtle'
                  }`
                }
              />
            ))}

            {/* 中间的新增按钮：放在导航栏里，避免浮动按钮遮住列表内容 */}
            <div className="flex flex-1 items-center justify-center">
              <button
                type="button"
                onClick={() => setShowAddModal(true)}
                aria-label={t('nav.add')}
                className="flex h-11 w-11 items-center justify-center rounded-full bg-brand text-white shadow-sm transition-colors hover:bg-brand/90"
              >
                <Plus size={22} aria-hidden="true" />
              </button>
            </div>

            {navItems.slice(2).map((item) => (
              <NavItem
                key={item.to}
                to={item.to}
                end={item.to === '/'}
                label={t(item.labelKey)}
                icon={<item.icon size={21} strokeWidth={2} aria-hidden="true" />}
                className={(isActive) =>
                  `flex flex-1 flex-col items-center justify-center gap-1 py-2.5 text-[11px] font-medium transition-colors ${
                    isActive ? 'text-brand' : 'text-ink-subtle'
                  }`
                }
              />
            ))}
          </div>
        </nav>

        {showAddModal && <AddTransactionModal onClose={() => setShowAddModal(false)} />}
      </div>
    </BrowserRouter>
  );
}
