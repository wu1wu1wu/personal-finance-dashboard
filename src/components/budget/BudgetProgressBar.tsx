// ============================================================
// BudgetProgressBar 组件 - 预算进度条 + 预警标识
// ============================================================

import type { BudgetStatus } from '@/types';
import { getWarningStyle, getCategoryInfo } from '@/core/budget-engine';
import { formatCurrency } from '@/utils/format';

interface BudgetProgressBarProps {
  /** 预算状态 */
  status: BudgetStatus;
  /** 是否为总预算（显示不同样式） */
  isTotal?: boolean;
}

export default function BudgetProgressBar({ status, isTotal = false }: BudgetProgressBarProps) {
  const style = getWarningStyle(status.level);
  const catInfo = isTotal ? null : getCategoryInfo(status.category);
  const pct = Math.min(status.percentage * 100, 100);
  const isOver = status.percentage > 1;

  return (
    <div className={`rounded-lg border p-3 ${isTotal ? 'bg-gray-50 border-gray-200' : 'bg-white border-gray-100'}`}>
      {/* 标题行 */}
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          {catInfo && (
            <span
              className="inline-flex items-center justify-center w-6 h-6 rounded-full text-sm"
              style={{ backgroundColor: catInfo.color + '18' }}
            >
              {catInfo.icon}
            </span>
          )}
          {isTotal && <span className="text-sm">💰</span>}
          <span className={`font-medium ${isTotal ? 'text-base' : 'text-sm'} text-gray-900`}>
            {isTotal ? '总预算' : status.category}
          </span>
        </div>

        <div className="flex items-center gap-2">
          {/* 预警标签 */}
          <span
            className="text-xs px-1.5 py-0.5 rounded-full font-medium"
            style={{ color: style.color, backgroundColor: style.bgColor }}
          >
            {style.icon} {style.label}
          </span>
        </div>
      </div>

      {/* 进度条 */}
      <div className="relative h-2.5 bg-gray-100 rounded-full overflow-hidden">
        <div
          className="absolute left-0 top-0 h-full rounded-full transition-all duration-500"
          style={{
            width: `${pct}%`,
            backgroundColor: style.color,
          }}
        />
        {/* 超支部分闪烁效果 */}
        {isOver && (
          <div
            className="absolute top-0 h-full rounded-full animate-pulse"
            style={{
              left: '100%',
              width: `${Math.min((status.percentage - 1) * 100, 20)}%`,
              backgroundColor: '#DC2626',
              opacity: 0.6,
            }}
          />
        )}
      </div>

      {/* 金额详情 */}
      <div className="flex items-center justify-between mt-1.5 text-xs text-gray-500">
        <span>
          已支出 <span className="font-medium text-gray-700">{formatCurrency(status.spent)}</span>
        </span>
        <span>
          预算 <span className="font-medium text-gray-700">{formatCurrency(status.limit)}</span>
        </span>
      </div>

      {/* 超支金额提示 */}
      {isOver && (
        <div className="mt-1 text-xs text-red-600">
          超支 {formatCurrency(status.spent - status.limit)}
        </div>
      )}

      {/* 剩余金额提示（未超支时） */}
      {!isOver && status.percentage >= 0.5 && (
        <div className="mt-1 text-xs" style={{ color: style.color }}>
          剩余 {formatCurrency(status.limit - status.spent)}（{Math.round((1 - status.percentage) * 100)}%）
        </div>
      )}
    </div>
  );
}