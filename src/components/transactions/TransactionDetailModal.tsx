// ============================================================
// TransactionDetailModal - 交易详情：改分类 / 查看完整信息 / 删除
// ============================================================

import { useMemo, useState } from 'react';
import type { Transaction } from '@/types';
import { CATEGORIES } from '@/types';
import { useTransactionStore } from '@/stores/transaction-store';
import { useClassificationStore } from '@/stores/classification-store';
import { TRANSFER_CATEGORY } from '@/core/transaction-query';
import { formatCurrency } from '@/utils/format';
import { cn } from '@/utils/cn';
import Modal from '@/components/ui/Modal';
import CategoryIcon from '@/components/ui/CategoryIcon';
import CategoryTag from '@/components/transactions/CategoryTag';

interface TransactionDetailModalProps {
  txn: Transaction;
  onClose: () => void;
}

export default function TransactionDetailModal({ txn, onClose }: TransactionDetailModalProps) {
  const deleteTransaction = useTransactionStore((s) => s.deleteTransaction);
  const updateCategory = useTransactionStore((s) => s.updateCategory);
  const transactions = useTransactionStore((s) => s.transactions);
  const recordFeedback = useClassificationStore((s) => s.recordFeedback);
  const [confirming, setConfirming] = useState(false);

  // 快速归类：优先给用户最常用的 6 个分类，没有历史就按默认顺序
  const quickCategories = useMemo(() => {
    const counts = new Map<string, number>();
    for (const t of transactions) {
      if (!t.category || t.category === '待确认') continue;
      counts.set(t.category, (counts.get(t.category) ?? 0) + 1);
    }
    const ordered = [...counts.entries()].sort((a, b) => b[1] - a[1]).map(([name]) => name);
    const names =
      ordered.length > 0
        ? ordered
        : CATEGORIES.filter((c) => c.name !== '待确认').map((c) => c.name);
    return names
      .slice(0, 6)
      .map((name) => CATEGORIES.find((c) => c.name === name) ?? CATEGORIES[CATEGORIES.length - 1]);
  }, [transactions]);

  const handleQuickCategorize = (category: string) => {
    if (category === txn.category) return;
    updateCategory(txn.id, category);
    // 与 CategoryTag 保持一致，顺手记录反馈关键词
    const words = `${txn.counterparty} ${txn.description}`
      .toLowerCase()
      .split(/\s+/)
      .filter((w) => w.length >= 2);
    if (words.length > 0) recordFeedback(words[0], category);
  };

  const isExpense = txn.amount > 0;
  const isTransfer = txn.category === TRANSFER_CATEGORY;

  const rows: { label: string; value: string }[] = [
    { label: '交易时间', value: txn.transactionTime || '—' },
    { label: '收支类型', value: txn.transactionType || '—' },
    { label: '交易对方', value: txn.counterparty || '—' },
    { label: '商品说明', value: txn.description || '—' },
    { label: '支付方式', value: txn.paymentMethod || '—' },
    { label: '交易状态', value: txn.paymentStatus || '—' },
    { label: '交易单号', value: txn.transactionNo || '—' },
    {
      label: '分类来源',
      value:
        txn.categorySource === 'manual'
          ? '手动指定'
          : txn.categorySource === 'guessed'
            ? '习惯推测'
            : '自动识别',
    },
    { label: '周期交易', value: txn.isPeriodic ? '是' : '否' },
    { label: '导入时间', value: txn.createdAt ? new Date(txn.createdAt).toLocaleString('zh-CN') : '—' },
  ];

  const handleDelete = () => {
    deleteTransaction(txn.id);
    onClose();
  };

  return (
    <Modal
      onClose={onClose}
      title={txn.counterparty || txn.description || '未知交易'}
      description={txn.transactionTime}
      headerExtra={
        <span
          className={cn(
            'tnum whitespace-nowrap text-base font-semibold',
            isTransfer ? 'text-ink-muted' : isExpense ? 'text-expense' : 'text-income',
          )}
        >
          {isTransfer ? '' : isExpense ? '-' : '+'}
          {formatCurrency(Math.abs(txn.amount))}
        </span>
      }
      footer={
        confirming ? (
          <div className="flex gap-2">
            <button
              type="button"
              onClick={handleDelete}
              className="flex-1 rounded-lg bg-expense py-2.5 text-sm font-medium text-white transition-colors hover:bg-expense/90"
            >
              确认删除
            </button>
            <button
              type="button"
              onClick={() => setConfirming(false)}
              className="flex-1 rounded-lg bg-canvas py-2.5 text-sm text-ink-muted transition-colors hover:text-ink"
            >
              取消
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setConfirming(true)}
            className="w-full rounded-lg border border-expense-soft py-2.5 text-sm text-expense transition-colors hover:bg-expense-soft"
          >
            删除这笔交易
          </button>
        )
      }
    >
      <div className="space-y-4 pb-1">
        {/* 封面图 */}
        {txn.coverImage && (
          <img
            src={txn.coverImage}
            alt="账单封面"
            className="max-h-56 w-full rounded-lg object-cover"
          />
        )}

        {/* 当前分类 */}
        <div className="flex items-center justify-between gap-3 border-b border-line pb-3">
          <span className="text-sm text-ink-muted">分类</span>
          <CategoryTag
            transactionId={txn.id}
            category={txn.category}
            counterparty={txn.counterparty}
            description={txn.description}
            source={txn.categorySource}
            editable
          />
        </div>

        {/* 快速归类 */}
        <div className="border-b border-line pb-3">
          <p className="mb-2 text-xs text-ink-subtle">快速归类</p>
          <div className="grid grid-cols-3 gap-2">
            {quickCategories.map((item) => {
              const active = item.name === txn.category;
              return (
                <button
                  key={item.name}
                  type="button"
                  onClick={() => handleQuickCategorize(item.name)}
                  aria-pressed={active}
                  className={cn(
                    'flex flex-col items-center gap-1 rounded-lg border px-1 py-2 text-xs transition-colors',
                    active
                      ? 'border-brand/40 bg-brand-soft text-brand'
                      : 'border-line text-ink-muted hover:bg-canvas hover:text-ink',
                  )}
                >
                  <CategoryIcon category={item.name} size={16} />
                  <span className="w-full truncate text-center">{item.name}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* 明细 */}
        <dl className="space-y-2.5">
          {rows.map((row) => (
            <div key={row.label} className="flex items-start justify-between gap-4">
              <dt className="shrink-0 text-sm text-ink-muted">{row.label}</dt>
              <dd className="text-right text-sm text-ink break-all">{row.value}</dd>
            </div>
          ))}

          {txn.tags.length > 0 && (
            <div className="flex items-start justify-between gap-4">
              <dt className="shrink-0 text-sm text-ink-muted">标签</dt>
              <dd className="flex flex-wrap justify-end gap-1">
                {txn.tags.map((tag) => (
                  <span key={tag} className="rounded-full bg-canvas px-2 py-0.5 text-xs text-ink-muted">
                    {tag}
                  </span>
                ))}
              </dd>
            </div>
          )}
        </dl>
      </div>
    </Modal>
  );
}
