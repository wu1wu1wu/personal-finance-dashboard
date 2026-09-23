// ============================================================
// TransactionCard - 主题卡片
//
// 给账单设了主题或配图后，会以卡片形式陈列出来。
// 布局按「金额 / 主题 / 类型 / 时间」四块，点进去跳到明细里对应那笔。
// ============================================================

import { X } from 'lucide-react';
import type { Transaction } from '@/types';
import { CATEGORIES } from '@/types';
import { TRANSFER_CATEGORY } from '@/core/transaction-query';
import { formatAmountCompact, formatDateShort } from '@/utils/format';
import { cn } from '@/utils/cn';
import CategoryIcon from '@/components/ui/CategoryIcon';

interface TransactionCardProps {
  txn: Transaction;
  /** 点击卡片：跳到明细页打开这笔 */
  onClick?: () => void;
  /** 删除这张卡片的主题（保留交易本身） */
  onClearTheme?: () => void;
}

export default function TransactionCard({ txn, onClick, onClearTheme }: TransactionCardProps) {
  const cat = CATEGORIES.find((c) => c.name === txn.category) ?? CATEGORIES[CATEGORIES.length - 1];
  const isExpense = txn.amount > 0;
  const isTransfer = txn.category === TRANSFER_CATEGORY;
  const hasImage = Boolean(txn.coverImage);

  // 圆形里的金额用颜色区分收支方向，不再重复加正负号
  const amountColor = isTransfer ? 'text-ink-muted' : isExpense ? 'text-expense' : 'text-income';
  const amountCircleStyle = hasImage
    ? undefined
    : { backgroundColor: `${cat.color}14`, color: cat.color };

  return (
    <li className="relative">
      <button
        type="button"
        onClick={onClick}
        aria-label={`查看 ${txn.theme || txn.counterparty || '这笔交易'} 的详情`}
        className={cn(
          'relative block w-full overflow-hidden rounded-2xl border text-left transition-shadow hover:shadow-md',
          hasImage ? 'border-transparent' : 'border-line bg-surface',
        )}
      >
        {/* 可选配图作为卡片背景 */}
        {hasImage && (
          <>
            <img
              src={txn.coverImage}
              alt=""
              width={800}
              height={450}
              loading="lazy"
              className="absolute inset-0 h-full w-full object-cover"
            />
            <span
              className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/45 to-black/25"
              aria-hidden="true"
            />
          </>
        )}

        <div className="relative p-4">
          {/* 金额 + 主题 */}
          <div className="flex items-center gap-3">
            <span
              className={cn(
                'flex h-16 w-16 shrink-0 flex-col items-center justify-center rounded-full',
                hasImage ? 'bg-white/20 text-white' : amountColor,
              )}
              style={amountCircleStyle}
            >
              <span className="tnum text-[15px] font-semibold leading-none">
                {formatAmountCompact(txn.amount)}
              </span>
              <span className="mt-0.5 text-[10px] opacity-80">元</span>
            </span>

            <span className="min-w-0 flex-1">
              <span
                className={cn(
                  'block text-base font-medium',
                  hasImage ? 'text-white' : 'text-ink',
                )}
              >
                {txn.theme || txn.counterparty || txn.description || '未命名'}
              </span>
              <span
                className={cn(
                  'mt-0.5 block truncate text-xs',
                  hasImage ? 'text-white/85' : 'text-ink-subtle',
                )}
              >
                {txn.counterparty || txn.description || '未知交易'}
              </span>
            </span>
          </div>

          {/* 类型 + 时间 */}
          <div
            className={cn(
              'mt-3 flex items-center justify-between gap-3 text-xs',
              hasImage ? 'text-white/80' : 'text-ink-subtle',
            )}
          >
            <span className="inline-flex items-center gap-1 truncate">
              <CategoryIcon category={txn.category} size={12} />
              {txn.category}
            </span>
            <span className="shrink-0 tnum">{formatDateShort(txn.transactionTime)}</span>
          </div>
        </div>
      </button>

      {/* 移除主题：放在外层，避免按钮嵌套 */}
      {onClearTheme && (txn.theme || hasImage) && (
        <button
          type="button"
          onClick={onClearTheme}
          aria-label="移除主题"
          className={cn(
            'absolute right-2 top-2 flex h-7 w-7 items-center justify-center rounded-full transition-colors',
            hasImage
              ? 'bg-black/45 text-white hover:bg-expense'
              : 'bg-canvas text-ink-subtle hover:bg-expense-soft hover:text-expense',
          )}
        >
          <X size={13} aria-hidden="true" />
        </button>
      )}
    </li>
  );
}
