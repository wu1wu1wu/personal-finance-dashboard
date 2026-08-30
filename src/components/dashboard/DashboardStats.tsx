// ============================================================
// DashboardStats 组件 - 看板关键指标卡片
// ============================================================

import type { DashboardMetrics } from '@/core/dashboard-engine';
import { formatCurrency, formatCurrencyShort } from '@/utils/format';

interface DashboardStatsProps {
  metrics: DashboardMetrics;
}

interface StatCard {
  label: string;
  value: string;
  icon: string;
  color: string;
  sub?: string;
}

export default function DashboardStats({ metrics }: DashboardStatsProps) {
  const cards: StatCard[] = [
    {
      label: '总支出',
      value: formatCurrencyShort(metrics.totalExpense),
      icon: '💸',
      color: '#EF4444',
      sub: metrics.totalIncome > 0 ? `收入 ${formatCurrencyShort(metrics.totalIncome)}` : undefined,
    },
    {
      label: '日均消费',
      value: formatCurrency(metrics.dailyAverage),
      icon: '📊',
      color: '#3B82F6',
    },
    {
      label: '最大单笔',
      value: formatCurrency(metrics.maxSingle),
      icon: '🔝',
      color: '#F59E0B',
    },
    {
      label: '分类数',
      value: `${metrics.categoryCount}`,
      icon: '🏷️',
      color: '#8B5CF6',
      sub: `${metrics.transactionCount} 笔交易`,
    },
  ];

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
      {cards.map((card) => (
        <div
          key={card.label}
          className="bg-white rounded-xl border border-gray-100 p-4 hover:shadow-sm transition-shadow"
        >
          <div className="flex items-center gap-2 mb-2">
            <span className="text-lg">{card.icon}</span>
            <span className="text-xs text-gray-500">{card.label}</span>
          </div>
          <div className="text-xl font-bold text-gray-900" style={{ color: card.color }}>
            {card.value}
          </div>
          {card.sub && (
            <div className="text-xs text-gray-400 mt-1">{card.sub}</div>
          )}
        </div>
      ))}
    </div>
  );
}