// ============================================================
// BudgetProgressBar - 预算执行进度 + 预警标识
// ============================================================

import { Wallet } from 'lucide-react';
import type { BudgetStatus } from '@/types';
import { getWarningStyle, getCategoryInfo } from '@/core/budget-engine';
import { formatCurrency } from '@/utils/format';
import { cn } from '@/utils/cn';
import CategoryIcon from '@/components/ui/CategoryIcon';

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
    <div
      className={cn(
        'rounded-xl border p-3',
        isTotal ? 'border-line bg-canvas' : 'border-line bg-surface',
      )}
    >
      {/* 分类 + 状态 */}
      <div className="mb-2 flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2">
          {catInfo ? (
            <span
              className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full"
              style={{ backgroundColor: `${catInfo.color}18`, color: catInfo.color }}
            >
              <CategoryIcon category={catInfo.name} size={13} />
            </span>
          ) : (
            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-brand-soft text-brand">
              <Wallet size={13} aria-hidden="true" />
            </span>
          )}
          <span
            className={cn(
              'truncate font-medium text-ink',
              isTotal ? 'text-base' : 'text-sm',
            )}
          >
            {isTotal ? '总预算' : status.category}
          </span>
        </div>

        <span
          className="shrink-0 whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-medium"
          style={{ color: style.color, backgroundColor: style.bgColor }}
        >
          {style.label}
        </span>
      </div>

      {/* 进度条 */}
      <div className="relative h-2 overflow-hidden rounded-full bg-canvas">
        <div
          className="absolute left-0 top-0 h-full rounded-full transition-[width] duration-500"
          style={{ width: `${pct}%`, backgroundColor: style.color }}
        />
      </div>

      {/* 金额 */}
      <div className="tnum mt-1.5 flex items-center justify-between text-xs text-ink-muted">
        <span>
          已支出 <span className="font-medium text-ink">{formatCurrency(status.spent)}</span>
        </span>
        <span>
          预算 <span className="font-medium text-ink">{formatCurrency(status.limit)}</span>
        </span>
      </div>

      {isOver && (
        <p className="tnum mt-1 text-xs text-expense">
          已超支 {formatCurrency(status.spent - status.limit)}
        </p>
      )}

      {!isOver && status.percentage >= 0.5 && (
        <p className="tnum mt-1 text-xs" style={{ color: style.color }}>
          剩余 {formatCurrency(status.limit - status.spent)}（{Math.round((1 - status.percentage) * 100)}%）
        </p>
      )}
    </div>
  );
}
