// ============================================================
// TransactionRow - 紧凑交易行（只读）
//
// 用在概览页的「最近交易」。信息顺序按记账软件的阅读习惯：
// 左边是谁、什么时候，右边多少钱。
// ============================================================

import type { Transaction } from '@/types';
import { CATEGORIES } from '@/types';
import { TRANSFER_CATEGORY } from '@/core/transaction-query';
import { usePerTransactionLimits } from '@/hooks/usePerTransactionLimits';
import { formatCurrency, formatDateShort } from '@/utils/format';
import { cn } from '@/utils/cn';
import CategoryIcon from '@/components/ui/CategoryIcon';

interface TransactionRowProps {
  txn: Transaction;
  onClick?: () => void;
}

export default function TransactionRow({ txn, onClick }: TransactionRowProps) {
  const cat = CATEGORIES.find((c) => c.name === txn.category) ?? CATEGORIES[CATEGORIES.length - 1];
  const isExpense = txn.amount > 0;
  const isTransfer = txn.category === TRANSFER_CATEGORY;
  const limitOf = usePerTransactionLimits();
  const limit = limitOf(txn.category, txn.transactionTime.substring(0, 7));
  const overLimit = limit !== undefined && isExpense && !isTransfer && txn.amount > limit;

  return (
    <li>
      <button
        type="button"
        onClick={onClick}
        className="flex w-full items-center gap-3 rounded-lg px-2 py-2.5 text-left transition-colors hover:bg-canvas"
      >
        <span
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full"
          style={{ backgroundColor: `${cat.color}18`, color: cat.color }}
        >
          <CategoryIcon category={txn.category} size={17} />
        </span>

        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-medium text-ink">
            {txn.counterparty || txn.description || '未知交易'}
          </span>
          <span className="block truncate text-[11px] text-ink-subtle">
            {txn.category} · {formatDateShort(txn.transactionTime)}
          </span>
          {overLimit && (
            <span className="mt-0.5 block truncate text-[11px] text-alert">
              超过单笔上限 {formatCurrency(limit)}
            </span>
          )}
        </span>

        <span
          className={cn(
            'tnum shrink-0 whitespace-nowrap text-sm font-semibold',
            isTransfer ? 'text-ink-muted' : isExpense ? 'text-expense' : 'text-income',
          )}
        >
          {isTransfer ? '' : isExpense ? '-' : '+'}
          {formatCurrency(Math.abs(txn.amount))}
        </span>
      </button>
    </li>
  );
}
