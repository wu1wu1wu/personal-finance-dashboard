import { lazy, Suspense, useState } from 'react';
import { BrowserRouter, Routes, Route, NavLink, Navigate } from 'react-router-dom';
import {
  LayoutDashboard,
  Plus,
  ReceiptText,
  Wallet,
  Settings as SettingsIcon,
} from 'lucide-react';
import AddTransactionModal from '@/components/transactions/AddTransactionModal';
import PageFallback from '@/components/ui/PageFallback';
import PersistAlert from '@/components/ui/PersistAlert';
import { useAutoLedger } from '@/hooks/useAutoLedger';

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
const Cleanup = lazy(() => import('@/pages/Cleanup'));

const navItems = [
  { to: '/', label: '看板', icon: LayoutDashboard },
  { to: '/transactions', label: '明细', icon: ReceiptText },
  { to: '/budget', label: '预算', icon: Wallet },
  { to: '/settings', label: '设置', icon: SettingsIcon },
];

export default function App() {
  useAutoLedger();
  const [showAddModal, setShowAddModal] = useState(false);

  return (
    <BrowserRouter>
      <div className="min-h-screen bg-canvas">
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-50 focus:rounded-lg focus:bg-brand focus:px-3 focus:py-2 focus:text-sm focus:text-white"
        >
          跳到主要内容
        </a>

        {/* 存储写失败时的常驻告警：数据没落盘必须让用户看到 */}
        <PersistAlert />

        {/* 顶部导航（桌面端） */}
        <nav className="sticky top-0 z-30 hidden border-b border-line bg-surface md:block">
          <div className="mx-auto flex h-14 max-w-5xl items-center gap-1 px-4">
            <span className="mr-4 text-base font-semibold tracking-tight text-ink">记账</span>
            {navItems.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.to === '/'}
                className={({ isActive }) =>
                  `flex min-h-11 items-center gap-1.5 rounded-lg px-3 text-sm font-medium transition-colors ${
                    isActive
                      ? 'bg-brand-soft text-brand'
                      : 'text-ink-muted hover:bg-canvas hover:text-ink'
                  }`
                }
              >
                <item.icon size={16} aria-hidden="true" />
                {item.label}
              </NavLink>
            ))}

            <button
              type="button"
              onClick={() => setShowAddModal(true)}
              className="ml-auto flex min-h-11 items-center gap-1.5 rounded-lg bg-brand px-3 text-sm font-medium text-white transition-colors hover:bg-brand/90"
            >
              <Plus size={16} aria-hidden="true" />
              记一笔
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
              <Route path="/settings" element={<Settings />} />
              <Route path="/settings/import" element={<SettingsImport />} />
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
          aria-label="主导航"
          className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-surface pb-[env(safe-area-inset-bottom)] md:hidden"
        >
          <div className="flex items-stretch">
            {navItems.slice(0, 2).map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.to === '/'}
                className={({ isActive }) =>
                  `flex flex-1 flex-col items-center justify-center gap-1 py-2.5 text-[11px] font-medium transition-colors ${
                    isActive ? 'text-brand' : 'text-ink-subtle'
                  }`
                }
              >
                <item.icon size={21} strokeWidth={2} aria-hidden="true" />
                <span>{item.label}</span>
              </NavLink>
            ))}

            {/* 中间的新增按钮：放在导航栏里，避免浮动按钮遮住列表内容 */}
            <div className="flex flex-1 items-center justify-center">
              <button
                type="button"
                onClick={() => setShowAddModal(true)}
                aria-label="记一笔"
                className="flex h-11 w-11 items-center justify-center rounded-full bg-brand text-white shadow-sm transition-colors hover:bg-brand/90"
              >
                <Plus size={22} aria-hidden="true" />
              </button>
            </div>

            {navItems.slice(2).map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.to === '/'}
                className={({ isActive }) =>
                  `flex flex-1 flex-col items-center justify-center gap-1 py-2.5 text-[11px] font-medium transition-colors ${
                    isActive ? 'text-brand' : 'text-ink-subtle'
                  }`
                }
              >
                <item.icon size={21} strokeWidth={2} aria-hidden="true" />
                <span>{item.label}</span>
              </NavLink>
            ))}
          </div>
        </nav>

        {showAddModal && <AddTransactionModal onClose={() => setShowAddModal(false)} />}
      </div>
    </BrowserRouter>
  );
}
