// ============================================================
// CategoryIcon - 分类图标（统一的线性图标，替代原来的 emoji）
// ============================================================

import {
  ArrowLeftRight,
  Car,
  CircleQuestionMark,
  Gamepad2,
  GraduationCap,
  House,
  Pill,
  ShoppingBag,
  Tag,
  Utensils,
  type LucideIcon,
} from 'lucide-react';

const CATEGORY_ICONS: Record<string, LucideIcon> = {
  餐饮美食: Utensils,
  交通出行: Car,
  购物消费: ShoppingBag,
  休闲娱乐: Gamepad2,
  居住生活: House,
  医疗健康: Pill,
  教育学习: GraduationCap,
  转账: ArrowLeftRight,
  其他: Tag,
  待确认: CircleQuestionMark,
};

/** 取分类对应的图标组件，未知分类回退到通用的标签图标 */
function getCategoryIcon(category: string): LucideIcon {
  return CATEGORY_ICONS[category] ?? Tag;
}

interface CategoryIconProps {
  category: string;
  size?: number;
  className?: string;
}

export default function CategoryIcon({ category, size = 18, className }: CategoryIconProps) {
  const Icon = getCategoryIcon(category);
  return <Icon size={size} strokeWidth={2} className={className} aria-hidden="true" />;
}
