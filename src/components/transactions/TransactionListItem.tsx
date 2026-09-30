// ============================================================
// TransactionListItem - 明细页的单行
//
// 抽出来并 memo 的原因：列表会随滚动不断变长，而页面里任何一次
// state 变化（输入关键词、切换筛选、勾选批量）都会重渲染所有行。
// props 全为原始值 + 稳定回调，未变化的行就能跳过重渲染。
//
// 单笔上限在页面层算好传进来，避免每行各调一次 hook。
// ============================================================

import { memo } from 'react';
import { Check, Trash, TriangleAlert } from 'lucide-react';
import type { Transaction } from '@/types';
import { CATEGORIES } from '@/types';
import { TRANSFER_CATEGORY } from '@/core/transaction-query';
import { formatCurrency } from '@/utils/format';
import { formatDateTimeForLocale, useLocale, useT } from '@/i18n';
import { cn } from '@/utils/cn';
import CategoryIcon from '@/components/ui/CategoryIcon';
import CategoryTag from '@/components/transactions/CategoryTag';

export interface TransactionListItemProps {
  txn: Transaction;
  /** 批量归类模式：整行点击变成勾选 */
  batchMode: boolean;
  checked: boolean;
  confirmingDelete: boolean;
  /** 该分类在该月的单笔消费上限；undefined 表示没设置 */
  limit?: number;
  onOpen: (id: string) => void;
  onToggleSelect: (id: string) => void;
  onRequestDelete: (id: string) => void;
  onConfirmDelete: (id: string) => void;
  onCancelDelete: () => void;
}

function TransactionListItem({
  txn,
  batchMode,
  checked,
  confirmingDelete,
  limit,
  onOpen,
  onToggleSelect,
  onRequestDelete,
  onConfirmDelete,
  onCancelDelete,
}: TransactionListItemProps) {
  const { t } = useT();
  const locale = useLocale();
  const cat = CATEGORIES.find((c) => c.name === txn.category) ?? CATEGORIES[CATEGORIES.length - 1];
  const isExpense = txn.amount > 0;
  const isTransfer = txn.category === TRANSFER_CATEGORY;
  const displayName = txn.counterparty || txn.description || t('transactions.unknown');
  // 单笔上限只对消费生效，转账不参与
  const overLimit = limit !== undefined && isExpense && !isTransfer && txn.amount > limit;

  return (
    <li
      className={cn(
        'relative flex items-center gap-3 rounded-xl border bg-surface p-3 transition-colors',
        // 长列表里只渲染视口附近的行；不支持的浏览器会自动忽略
        '[content-visibility:auto] [contain-intrinsic-size:64px]',
        checked ? 'border-brand/40 bg-brand-soft' : 'border-line hover:bg-canvas',
      )}
    >
      {/* 批量模式下整行可点切换选中；否则打开详情 */}
      <button
        type="button"
        onClick={() => (batchMode ? onToggleSelect(txn.id) : onOpen(txn.id))}
        aria-label={
          batchMode
            ? t('transactions.selectItem', { name: displayName })
            : t('transactions.viewDetail', { name: displayName })
        }
        aria-pressed={batchMode ? checked : undefined}
        className="absolute inset-0 z-0 rounded-xl"
      />

      {batchMode ? (
        <span
          className={cn(
            'pointer-events-none relative z-10 flex h-7 w-7 shrink-0 items-center justify-center rounded-md border-2 transition-colors',
            checked ? 'border-brand bg-brand text-white' : 'border-line bg-surface',
          )}
          aria-hidden="true"
        >
          {checked && <Check size={15} />}
        </span>
      ) : (
        <span
          className="pointer-events-none relative z-10 flex h-10 w-10 shrink-0 items-center justify-center rounded-full"
          style={{ backgroundColor: `${cat.color}18`, color: cat.color }}
        >
          <CategoryIcon category={txn.category} size={18} />
        </span>
      )}

      {/* 对方 + 时间 + 分类标签 */}
      <div className="pointer-events-none relative z-10 min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-ink">
          {txn.theme ? `${txn.theme} · ${displayName}` : displayName}
        </p>
        <div className="mt-0.5 flex items-center gap-1.5">
          {!batchMode && (
            <div className="pointer-events-auto shrink-0">
              <CategoryTag
                transactionId={txn.id}
                category={txn.category}
                counterparty={txn.counterparty}
                description={txn.description}
                source={txn.categorySource}
                editable
              />
            </div>
          )}
          <span className="min-w-0 truncate text-xs text-ink-subtle">
            {formatDateTimeForLocale(locale, txn.transactionTime)}
            {txn.description && ` · ${txn.description.substring(0, 20)}`}
          </span>
        </div>
        {overLimit && (
          <p className="mt-1 flex items-center gap-1 text-[11px] text-alert">
            <TriangleAlert size={11} aria-hidden="true" />
            {t('transactions.overLimit', { amount: formatCurrency(limit) })}
          </p>
        )}
      </div>

      {/* 金额 + 删除 */}
      <div className="relative z-10 flex shrink-0 flex-col items-end gap-1">
        <span
          className={cn(
            'tnum whitespace-nowrap text-sm font-semibold',
            isTransfer ? 'text-ink-muted' : isExpense ? 'text-expense' : 'text-income',
          )}
        >
          {isTransfer ? '' : isExpense ? '-' : '+'}
          {formatCurrency(Math.abs(txn.amount))}
        </span>

        {!batchMode &&
          (confirmingDelete ? (
            <div className="flex gap-1">
              <button
                type="button"
                onClick={() => onConfirmDelete(txn.id)}
                className="flex min-h-11 items-center rounded-lg bg-expense px-3 text-[11px] font-medium text-white hover:bg-expense/90"
              >
                {t('transactions.confirmDelete')}
              </button>
              <button
                type="button"
                onClick={onCancelDelete}
                className="flex min-h-11 items-center rounded-lg bg-canvas px-3 text-[11px] text-ink-muted hover:text-ink"
              >
                {t('common.cancel')}
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => onRequestDelete(txn.id)}
              aria-label={t('transactions.deleteNamed', { name: displayName })}
              className="flex min-h-11 min-w-11 items-center justify-center gap-1 rounded-lg text-[11px] text-ink-subtle transition-colors hover:bg-expense-soft hover:text-expense"
            >
              <Trash size={14} aria-hidden="true" />
              {t('common.delete')}
            </button>
          ))}
      </div>
    </li>
  );
}

export default memo(TransactionListItem);
