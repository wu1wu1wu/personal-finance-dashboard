import { useState } from 'react';
import { BrowserRouter, Routes, Route, NavLink } from 'react-router-dom';
import {
  LayoutDashboard,
  Plus,
  ReceiptText,
  Wallet,
  Settings as SettingsIcon,
} from 'lucide-react';
import Dashboard from '@/pages/Dashboard';
import Transactions from '@/pages/Transactions';
import Budget from '@/pages/Budget';
import Settings from '@/pages/Settings';
import Cleanup from '@/pages/Cleanup';
import AddTransactionModal from '@/components/transactions/AddTransactionModal';
import { useAutoLedger } from '@/hooks/useAutoLedger';

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
                  `flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
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
              className="ml-auto flex items-center gap-1.5 rounded-lg bg-brand px-3 py-1.5 text-sm font-medium text-white transition-colors hover:bg-brand/90"
            >
              <Plus size={16} aria-hidden="true" />
              记一笔
            </button>
          </div>
        </nav>

        {/* 页面内容 */}
        <main id="main" className="mx-auto max-w-5xl px-4 pb-28 pt-4 md:pb-10">
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/transactions" element={<Transactions />} />
            <Route path="/budget" element={<Budget />} />
            <Route path="/settings" element={<Settings />} />
            <Route path="/cleanup" element={<Cleanup />} />
          </Routes>
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
