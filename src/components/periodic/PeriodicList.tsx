// ============================================================
// PeriodicList - 周期性交易列表
// ============================================================

import { Calendar, CalendarDays, CalendarRange, RefreshCw, X } from 'lucide-react';
import type { PeriodicTransaction } from '@/types';
import { CATEGORIES } from '@/types';
import { categoryLabel, formatDateForLocale, useLocale, useT } from '@/i18n';
import type { MessageKey } from '@/i18n';
import { formatCurrency } from '@/utils/format';
import { cn } from '@/utils/cn';
import CategoryIcon from '@/components/ui/CategoryIcon';

interface PeriodicListProps {
  data: PeriodicTransaction[];
  onTogglePeriodic?: (counterparty: string, amount: number) => void;
}

/** 周期标签映射：图标与配色固定，文案按语言取 */
const PERIOD_LABELS: Record<
  string,
  { labelKey: MessageKey; icon: typeof Calendar; className: string }
> = {
  monthly: {
    labelKey: 'periodic.period.monthly',
    icon: CalendarDays,
    className: 'bg-brand-soft text-brand',
  },
  quarterly: {
    labelKey: 'periodic.period.quarterly',
    icon: CalendarRange,
    className: 'bg-canvas text-ink-muted',
  },
  yearly: {
    labelKey: 'periodic.period.yearly',
    icon: Calendar,
    className: 'bg-canvas text-ink-muted',
  },
};

export default function PeriodicList({ data, onTogglePeriodic }: PeriodicListProps) {
  const { t } = useT();
  const locale = useLocale();

  if (data.length === 0) {
    return (
      <section className="rounded-2xl border border-line bg-surface p-4">
        <h3 className="mb-3 flex items-center gap-1.5 text-sm font-semibold text-ink">
          <RefreshCw size={15} className="text-ink-subtle" aria-hidden="true" />
          {t('periodic.listTitle')}
        </h3>
        <div className="py-8 text-center">
          <p className="text-sm text-ink-muted">{t('periodic.emptyTitle')}</p>
          <p className="mt-1 text-xs text-ink-subtle">{t('periodic.emptyHint')}</p>
        </div>
      </section>
    );
  }

  return (
    <section className="rounded-2xl border border-line bg-surface p-4">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="flex items-center gap-1.5 text-sm font-semibold text-ink">
          <RefreshCw size={15} className="text-ink-subtle" aria-hidden="true" />
          {t('periodic.listTitle')}
        </h3>
        <span className="text-xs text-ink-subtle tnum">
          {t('periodic.detected', { count: data.length })}
        </span>
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
                    {item.counterparty || t('periodic.unknownCounterparty')}
                  </span>
                  <span
                    className={cn(
                      'inline-flex shrink-0 items-center gap-1 whitespace-nowrap rounded-full px-1.5 py-0.5 text-[11px] font-medium',
                      periodInfo.className,
                    )}
                  >
                    <PeriodIcon size={11} aria-hidden="true" />
                    {t(periodInfo.labelKey)}
                  </span>
                </div>
                <p className="mt-0.5 truncate text-xs text-ink-subtle">
                  {item.nextDate
                    ? t('periodic.nextExpected', {
                        date: formatDateForLocale(locale, item.nextDate),
                      })
                    : item.lastDate
                      ? t('periodic.lastSeen', {
                          date: formatDateForLocale(locale, item.lastDate),
                        })
                      : ''}
                  {' · '}
                  {categoryLabel(locale, item.category)}
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
                  aria-label={t('periodic.unmark', { name: item.counterparty })}
                  // 常驻可见：触屏上没有 hover，藏起来的按钮既点不到又容易被误触
                  className="flex min-h-11 min-w-11 shrink-0 items-center justify-center rounded-lg text-ink-subtle transition-colors hover:bg-expense-soft hover:text-expense"
                >
                  <X size={16} aria-hidden="true" />
                </button>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
