// ============================================================
// NavItem - 顶部/底部导航的一个入口
//
// 与直接用 NavLink 的区别只有一处：点「当前所在的页面」不再压一条
// 同样的历史（否则按系统返回键第一次会像没反应一样）。
// ============================================================

import type { ReactNode } from 'react';
import { NavLink, useLocation } from 'react-router-dom';

interface NavItemProps {
  to: string;
  icon: ReactNode;
  label: string;
  /** 按选中状态给出类名 */
  className: (isActive: boolean) => string;
  end?: boolean;
}

export default function NavItem({ to, icon, label, className, end }: NavItemProps) {
  const location = useLocation();
  // 已经在这一页了：用 replace，不新增历史
  const replace = location.pathname === to;

  return (
    <NavLink
      to={to}
      end={end ?? to === '/'}
      replace={replace}
      className={({ isActive }) => className(isActive)}
    >
      {icon}
      {label}
    </NavLink>
  );
}
