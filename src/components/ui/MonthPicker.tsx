// ============================================================
// MonthPicker - 年月选择器（看板 / 预算 / 明细共用）
//
// 原来是横滑的月份 chip 行：只写「9月」不带年份，选项还来自
// 「最近 6 个月 ∪ 有数据 ∪ 有预算 ∪ 下个月」，月份一攒多就成了一条
// 越来越长的横条，也看不出是哪一年。
//
// 现在触发按钮直接写全「2026年9月」，点开是「翻年份 + 12 个月网格」：
// 有记录的月份打个点，没记录的淡显但仍可选（可以空着月份设预算）。
// 面板复用 Modal（手机底部抽屉 / 桌面居中卡片），顺带白拿返回键处理。
// ============================================================

import { useMemo, useState } from 'react';
import { CalendarDays, ChevronDown, ChevronLeft, ChevronRight } from 'lucide-react';
import {
  buildYearMonths,
  monthsWithDataInYear,
  parseMonthKey,
  yearBounds,
} from '@/core/month-picker';
import { formatMonthForLocale, formatMonthShortForLocale, useLocale, useT } from '@/i18n';
import { getCurrentMonth } from '@/utils/date';
import { cn } from '@/utils/cn';
import Modal from '@/components/ui/Modal';

interface MonthPickerProps {
  /** 月份键 "2026-09"；allowAll 时空串表示「全部月份」 */
  value: string;
  onChange: (month: string) => void;
  /** 有记录的月份（网格上打点），传稳定引用免得每次渲染重算 */
  monthsWithData?: Iterable<string>;
  /** 是否提供「全部月份」这一档（明细页用） */
  allowAll?: boolean;
  /** 触发按钮的无障碍名称 */
  label?: string;
  triggerClassName?: string;
}

const NAV_BUTTON =
  'flex h-11 w-11 items-center justify-center rounded-lg text-ink-muted transition-colors hover:bg-canvas hover:text-ink disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent';

export default function MonthPicker({
  value,
  onChange,
  monthsWithData,
  allowAll = false,
  label,
  triggerClassName,
}: MonthPickerProps) {
  const { t } = useT();
  const locale = useLocale();
  const [open, setOpen] = useState(false);
  const dataMonths = useMemo(() => monthsWithData ?? [], [monthsWithData]);

  const bounds = useMemo(() => yearBounds(value, dataMonths), [value, dataMonths]);
  const [year, setYear] = useState(() => parseMonthKey(value)?.year ?? new Date().getFullYear());

  const openPanel = () => {
    // 每次打开都定位到当前选中的年份，而不是上次翻到哪就停在哪
    setYear(parseMonthKey(value)?.year ?? new Date().getFullYear());
    setOpen(true);
  };

  const months = useMemo(() => buildYearMonths(year), [year]);
  const withData = useMemo(() => monthsWithDataInYear(dataMonths, year), [dataMonths, year]);
  const selected = parseMonthKey(value);

  const pick = (month: string) => {
    onChange(month);
    setOpen(false);
  };

  return (
    <>
      <button
        type="button"
        onClick={openPanel}
        aria-label={label ?? t('common.monthPicker.label')}
        aria-haspopup="dialog"
        className={cn(
          'flex min-h-11 items-center gap-1.5 rounded-lg border border-line bg-surface px-3 text-sm font-medium text-ink transition-colors hover:bg-canvas',
          triggerClassName,
        )}
      >
        <CalendarDays size={15} className="text-ink-subtle" aria-hidden="true" />
        <span className="tnum">
          {value ? formatMonthForLocale(locale, value) : t('common.monthPicker.allMonths')}
        </span>
        <ChevronDown size={14} className="text-ink-subtle" aria-hidden="true" />
      </button>

      {open && (
        <Modal
          onClose={() => setOpen(false)}
          title={t('common.monthPicker.label')}
          description={t('common.monthPicker.description')}
        >
          <div className="space-y-3 pb-1">
            {/* 年份 */}
            <div className="flex items-center justify-between">
              <button
                type="button"
                onClick={() => setYear((current) => current - 1)}
                disabled={year <= bounds.min}
                aria-label={t('common.monthPicker.prevYear')}
                className={NAV_BUTTON}
              >
                <ChevronLeft size={18} aria-hidden="true" />
              </button>
              <span className="tnum text-base font-semibold text-ink">
                {t('common.monthPicker.yearLabel', { year })}
              </span>
              <button
                type="button"
                onClick={() => setYear((current) => current + 1)}
                disabled={year >= bounds.max}
                aria-label={t('common.monthPicker.nextYear')}
                className={NAV_BUTTON}
              >
                <ChevronRight size={18} aria-hidden="true" />
              </button>
            </div>

            {/* 12 个月 */}
            <div className="grid grid-cols-3 gap-2">
              {months.map((monthKey) => {
                const parts = parseMonthKey(monthKey);
                const active = monthKey === value;
                const hasData = parts ? withData.has(parts.month) : false;
                return (
                  <button
                    key={monthKey}
                    type="button"
                    onClick={() => pick(monthKey)}
                    aria-pressed={active}
                    aria-label={formatMonthForLocale(locale, monthKey)}
                    className={cn(
                      'flex min-h-11 flex-col items-center justify-center rounded-lg border text-sm transition-colors',
                      active
                        ? 'border-brand bg-brand font-medium text-white'
                        : hasData
                          ? 'border-line bg-surface text-ink hover:bg-canvas'
                          : 'border-line bg-surface text-ink-subtle hover:bg-canvas',
                    )}
                  >
                    <span>{formatMonthShortForLocale(locale, monthKey)}</span>
                    {hasData && !active && (
                      <span className="mt-0.5 h-1 w-1 rounded-full bg-brand" aria-hidden="true" />
                    )}
                  </button>
                );
              })}
            </div>

            <div className="flex items-center justify-between gap-2 pt-1">
              {allowAll ? (
                <button
                  type="button"
                  onClick={() => pick('')}
                  aria-pressed={!value}
                  className={cn(
                    'flex min-h-11 items-center rounded-lg border px-3 text-sm transition-colors',
                    !value
                      ? 'border-brand bg-brand-soft font-medium text-brand'
                      : 'border-line text-ink-muted hover:bg-canvas hover:text-ink',
                  )}
                >
                  {t('common.monthPicker.allMonths')}
                </button>
              ) : (
                <span />
              )}

              <button
                type="button"
                onClick={() => pick(getCurrentMonth())}
                className="flex min-h-11 items-center rounded-lg border border-line px-3 text-sm text-ink-muted transition-colors hover:bg-canvas hover:text-ink"
              >
                {t('common.monthPicker.thisMonth')}
              </button>
            </div>

            <p className="text-[11px] text-ink-subtle">{t('common.monthPicker.dataHint')}</p>

            {selected && (
              <p className="text-[11px] text-ink-subtle">
                {t('common.monthPicker.currentHint', {
                  month: formatMonthForLocale(locale, value),
                })}
              </p>
            )}
          </div>
        </Modal>
      )}
    </>
  );
}
