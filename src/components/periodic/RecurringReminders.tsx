// ============================================================
// RecurringReminders - 周期扣款提醒卡片
//
// 只回答两件事：接下来要扣什么钱、该扣的有没有扣。
// 明细页与「更多分析」里的周期列表负责完整清单，这里保持紧凑。
// ============================================================

import { BellOff, BellRing, ChevronDown, RotateCcw, TriangleAlert } from 'lucide-react';
import type { RecurringReminder, RecurringSummary } from '@/core/recurring-reminder';
import { categoryLabel, formatDateForLocale, useLocale, useT } from '@/i18n';
import { cn } from '@/utils/cn';
import { formatCurrency } from '@/utils/format';

interface RecurringRemindersProps {
  reminders: RecurringReminder[];
  summary: RecurringSummary;
  /** 用户已忽略的商户名 */
  ignored: string[];
  onIgnore: (counterparty: string) => void;
  onRestore: (counterparty: string) => void;
}

/** 卡片里最多列几条，其余留给「更多分析」 */
const MAX_ROWS = 5;

export default function RecurringReminders({
  reminders,
  summary,
  ignored,
  onIgnore,
  onRestore,
}: RecurringRemindersProps) {
  const { t } = useT();
  const locale = useLocale();

  const visible = reminders.slice(0, MAX_ROWS);

  const statusText = (reminder: RecurringReminder): string => {
    if (reminder.status === 'overdue') {
      return t('recurring.overdueDays', { count: Math.abs(reminder.daysUntil) });
    }
    if (reminder.daysUntil <= 0) return t('recurring.today');
    return t('recurring.inDays', { count: reminder.daysUntil });
  };

  return (
    <section className="rounded-2xl border border-line bg-surface p-4">
      <div className="flex items-start justify-between gap-3">
        <h2 className="flex items-center gap-1.5 text-sm font-semibold text-ink">
          <BellRing size={15} className="text-ink-subtle" aria-hidden="true" />
          {t('recurring.title')}
        </h2>
        {summary.reminderCount > 0 && (
          <div className="text-right">
            <p className="text-[11px] text-ink-subtle">{t('recurring.monthlyTotal')}</p>
            <p className="tnum text-sm font-semibold text-ink">
              {formatCurrency(summary.monthlyTotal)}
            </p>
          </div>
        )}
      </div>

      {summary.overdueCount > 0 && (
        <div className="mt-3 flex items-start gap-2 rounded-xl bg-alert-soft px-3 py-2.5">
          <TriangleAlert size={16} className="mt-0.5 shrink-0 text-alert" aria-hidden="true" />
          <div className="min-w-0">
            <p className="text-xs font-medium text-alert">
              {t('recurring.overdueTitle')} · {t('recurring.summary', { count: summary.overdueCount })}
            </p>
            <p className="mt-0.5 text-[11px] leading-relaxed text-alert/90">
              {t('recurring.overdueHint')}
            </p>
          </div>
        </div>
      )}

      <ul className="mt-2 divide-y divide-line">
        {visible.map((reminder) => (
          <li key={`${reminder.counterparty}-${reminder.nextDate}`} className="flex items-center gap-2 py-2.5">
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm text-ink">{reminder.counterparty}</p>
              <p className="mt-0.5 flex flex-wrap items-center gap-x-2 text-[11px] text-ink-subtle">
                <span className={cn(reminder.status === 'overdue' && 'font-medium text-alert')}>
                  {statusText(reminder)}
                </span>
                <span>{t('recurring.expectedOn', { date: formatDateForLocale(locale, reminder.nextDate) })}</span>
                <span className="text-ink-subtle/80">{categoryLabel(locale, reminder.category)}</span>
              </p>
              {reminder.priceChanged && (
                <p className="mt-0.5 text-[11px] text-alert">
                  {t('recurring.priceChanged', {
                    previous: formatCurrency(reminder.previousAmount),
                    amount: formatCurrency(reminder.amount),
                  })}
                </p>
              )}
            </div>

            <span className="tnum shrink-0 text-sm font-medium text-ink">
              {formatCurrency(reminder.amount)}
            </span>

            <button
              type="button"
              onClick={() => onIgnore(reminder.counterparty)}
              aria-label={t('recurring.ignore', { name: reminder.counterparty })}
              title={t('recurring.ignore', { name: reminder.counterparty })}
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg text-ink-subtle transition-colors hover:bg-canvas hover:text-ink"
            >
              <BellOff size={16} aria-hidden="true" />
            </button>
          </li>
        ))}
      </ul>

      {ignored.length > 0 && (
        <details className="group mt-1 border-t border-line pt-2">
          <summary className="flex cursor-pointer list-none items-center gap-1 py-1 text-xs text-ink-subtle [&::-webkit-details-marker]:hidden">
            {t('recurring.ignoredTitle', { count: ignored.length })}
            <ChevronDown
              size={14}
              className="transition-transform group-open:rotate-180"
              aria-hidden="true"
            />
          </summary>
          <ul className="mt-1 space-y-1">
            {ignored.map((name) => (
              <li key={name} className="flex items-center gap-2">
                <span className="min-w-0 flex-1 truncate text-xs text-ink-muted">{name}</span>
                <button
                  type="button"
                  onClick={() => onRestore(name)}
                  aria-label={t('recurring.restore', { name })}
                  className="flex min-h-8 items-center gap-1 rounded-md px-2 text-[11px] text-brand transition-colors hover:bg-brand-soft"
                >
                  <RotateCcw size={12} aria-hidden="true" />
                  {t('common.restore')}
                </button>
              </li>
            ))}
          </ul>
        </details>
      )}

      {reminders.length === 0 && (
        <p className="py-3 text-xs text-ink-subtle">{t('recurring.empty')}</p>
      )}
    </section>
  );
}
