import { BrowserRouter, Routes, Route, NavLink } from 'react-router-dom';
import Dashboard from '@/pages/Dashboard';
import Transactions from '@/pages/Transactions';
import Budget from '@/pages/Budget';
import Settings from '@/pages/Settings';

const navItems = [
  { to: '/', label: '看板', icon: '📊' },
  { to: '/transactions', label: '明细', icon: '📋' },
  { to: '/budget', label: '预算', icon: '💰' },
  { to: '/settings', label: '设置', icon: '⚙️' },
];

export default function App() {
  return (
    <BrowserRouter>
      <div className="min-h-screen bg-gray-50">
        {/* 顶部导航（桌面端） */}
        <nav className="sticky top-0 z-10 bg-white border-b border-gray-200 shadow-sm hidden md:block">
          <div className="max-w-5xl mx-auto px-4 flex items-center h-12 gap-1">
            <span className="font-bold text-lg mr-4">💰 记账</span>
            {navItems.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.to === '/'}
                className={({ isActive }) =>
                  `px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                    isActive
                      ? 'bg-blue-50 text-blue-700'
                      : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
                  }`
                }
              >
                {item.label}
              </NavLink>
            ))}
          </div>
        </nav>

        {/* 页面内容 */}
        <main className="max-w-5xl mx-auto px-4 py-4 pb-24 md:pb-4">
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/transactions" element={<Transactions />} />
            <Route path="/budget" element={<Budget />} />
            <Route path="/settings" element={<Settings />} />
          </Routes>
        </main>

        {/* 底部导航（移动端） */}
        <nav className="fixed bottom-0 left-0 right-0 z-10 bg-white border-t border-gray-200 pb-[env(safe-area-inset-bottom)] md:hidden">
          <div className="flex items-stretch">
            {navItems.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.to === '/'}
                className={({ isActive }) =>
                  `flex-1 flex flex-col items-center justify-center gap-0.5 py-2 text-xs font-medium transition-colors ${
                    isActive ? 'text-blue-600' : 'text-gray-500'
                  }`
                }
              >
                <span className="text-xl leading-none">{item.icon}</span>
                <span>{item.label}</span>
              </NavLink>
            ))}
          </div>
        </nav>
      </div>
    </BrowserRouter>
  );
}