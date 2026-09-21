// ============================================================
// PeriodicList - 周期性交易列表
// ============================================================

import { Calendar, CalendarDays, CalendarRange, RefreshCw, X } from 'lucide-react';
import type { PeriodicTransaction } from '@/types';
import { CATEGORIES } from '@/types';
import { formatCurrency } from '@/utils/format';
import { cn } from '@/utils/cn';
import CategoryIcon from '@/components/ui/CategoryIcon';

interface PeriodicListProps {
  data: PeriodicTransaction[];
  onTogglePeriodic?: (counterparty: string, amount: number) => void;
}

/** 周期标签映射 */
const PERIOD_LABELS: Record<
  string,
  { label: string; icon: typeof Calendar; className: string }
> = {
  monthly: { label: '月度', icon: CalendarDays, className: 'bg-brand-soft text-brand' },
  quarterly: { label: '季度', icon: CalendarRange, className: 'bg-canvas text-ink-muted' },
  yearly: { label: '年度', icon: Calendar, className: 'bg-canvas text-ink-muted' },
};

export default function PeriodicList({ data, onTogglePeriodic }: PeriodicListProps) {
  if (data.length === 0) {
    return (
      <section className="rounded-2xl border border-line bg-surface p-4">
        <h3 className="mb-3 flex items-center gap-1.5 text-sm font-semibold text-ink">
          <RefreshCw size={15} className="text-ink-subtle" aria-hidden="true" />
          周期性交易
        </h3>
        <div className="py-8 text-center">
          <p className="text-sm text-ink-muted">暂未检测到周期性交易</p>
          <p className="mt-1 text-xs text-ink-subtle">连续 3 个月以上相同金额的支出会被自动识别</p>
        </div>
      </section>
    );
  }

  return (
    <section className="rounded-2xl border border-line bg-surface p-4">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="flex items-center gap-1.5 text-sm font-semibold text-ink">
          <RefreshCw size={15} className="text-ink-subtle" aria-hidden="true" />
          周期性交易
        </h3>
        <span className="text-xs text-ink-subtle tnum">检测到 {data.length} 项</span>
      </div>

      <ul className="space-y-1">
        {data.map((item, index) => {
          const periodInfo = PERIOD_LABELS[item.period] ?? PERIOD_LABELS.monthly;
          const PeriodIcon = periodInfo.icon;
          const catInfo = CATEGORIES.find((c) => c.name === item.category);
          const confidencePercent = Math.round(item.confidence * 100);

          return (
            <li
              key={`${item.counterparty}-${item.amount}-${index}`}
              className="group flex items-center gap-3 rounded-lg p-2 transition-colors hover:bg-canvas"
            >
              <span
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full"
                style={{
                  backgroundColor: `${catInfo?.color ?? '#6B7280'}18`,
                  color: catInfo?.color ?? '#6B7280',
                }}
              >
                <CategoryIcon category={item.category} size={16} />
              </span>

              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="truncate text-sm font-medium text-ink">
                    {item.counterparty || '未知'}
                  </span>
                  <span
                    className={cn(
                      'inline-flex shrink-0 items-center gap-1 whitespace-nowrap rounded-full px-1.5 py-0.5 text-[11px] font-medium',
                      periodInfo.className,
                    )}
                  >
                    <PeriodIcon size={11} aria-hidden="true" />
                    {periodInfo.label}
                  </span>
                </div>
                <p className="mt-0.5 truncate text-xs text-ink-subtle">
                  {item.nextDate
                    ? `下次预计 ${item.nextDate}`
                    : item.lastDate
                      ? `最近 ${item.lastDate}`
                      : ''}
                  {' · '}
                  {item.category}
                </p>
              </div>

              <div className="shrink-0 text-right">
                <p className="tnum whitespace-nowrap text-sm font-semibold text-ink">
                  {formatCurrency(item.amount)}
                </p>
                <div className="mt-1 flex items-center justify-end gap-1">
                  <div className="h-1 w-12 overflow-hidden rounded-full bg-canvas">
                    <div
                      className={cn(
                        'h-full rounded-full',
                        confidencePercent >= 80
                          ? 'bg-income'
                          : confidencePercent >= 50
                            ? 'bg-alert'
                            : 'bg-ink-subtle',
                      )}
                      style={{ width: `${confidencePercent}%` }}
                    />
                  </div>
                  <span className="tnum text-[11px] text-ink-subtle">{confidencePercent}%</span>
                </div>
              </div>

              {onTogglePeriodic && (
                <button
                  type="button"
                  onClick={() => onTogglePeriodic(item.counterparty, item.amount)}
                  aria-label={`取消标记 ${item.counterparty} 为周期交易`}
                  className="shrink-0 rounded-md p-1 text-ink-subtle opacity-0 transition-colors hover:bg-expense-soft hover:text-expense focus-visible:opacity-100 group-hover:opacity-100"
                >
                  <X size={14} aria-hidden="true" />
                </button>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
