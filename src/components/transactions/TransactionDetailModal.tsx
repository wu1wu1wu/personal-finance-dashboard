// ============================================================
// TransactionDetailModal - 交易详情：改分类 / 查看完整信息 / 删除
// ============================================================

import { useEffect, useMemo, useRef, useState } from 'react';
import { ImagePlus, TriangleAlert, X } from 'lucide-react';
import type { Transaction } from '@/types';
import { CATEGORIES } from '@/types';
import { useTransactionStore } from '@/stores/transaction-store';
import { useClassificationStore } from '@/stores/classification-store';
import { usePerTransactionLimits } from '@/hooks/usePerTransactionLimits';
import { TRANSFER_CATEGORY } from '@/core/transaction-query';
import { formatCurrency } from '@/utils/format';
import { cn } from '@/utils/cn';
import { compressImage } from '@/utils/image';
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
  const setTheme = useTransactionStore((s) => s.setTheme);
  const setCoverImage = useTransactionStore((s) => s.setCoverImage);
  const transactions = useTransactionStore((s) => s.transactions);
  const recordFeedback = useClassificationStore((s) => s.recordFeedback);
  const [confirming, setConfirming] = useState(false);

  const [themeInput, setThemeInput] = useState(txn.theme);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const limitOf = usePerTransactionLimits();

  // 切换交易时同步主题输入框
  useEffect(() => {
    setThemeInput(txn.theme);
  }, [txn.id, txn.theme]);

  const handlePickImage = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const dataUrl = await compressImage(file);
      setCoverImage(txn.id, dataUrl);
    } catch (err) {
      console.error('配图上传失败:', err);
    } finally {
      setUploading(false);
      e.target.value = '';
    }
  };

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
  const limit = limitOf(txn.category, txn.transactionTime.substring(0, 7));
  const overLimit = limit !== undefined && isExpense && !isTransfer && txn.amount > limit;

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
        {/* 单笔超限提示 */}
        {overLimit && (
          <p className="flex items-start gap-2 rounded-lg bg-alert-soft px-3 py-2.5 text-sm text-alert">
            <TriangleAlert size={15} className="mt-0.5 shrink-0" aria-hidden="true" />
            <span>
              这笔 {formatCurrency(txn.amount)} 超过了「{txn.category}」的单笔上限{' '}
              {formatCurrency(limit)}，超出 {formatCurrency(txn.amount - limit)}。
            </span>
          </p>
        )}

        {/* 主题 + 配图 */}
        <div className="border-b border-line pb-3">
          <label htmlFor="detail-theme" className="mb-1.5 block text-xs text-ink-subtle">
            主题
          </label>
          <div className="flex gap-2">
            <input
              id="detail-theme"
              name="theme"
              type="text"
              autoComplete="off"
              value={themeInput}
              onChange={(e) => setThemeInput(e.target.value)}
              placeholder="给这笔账单写个主题，如：和朋友的晚餐"
              className="min-w-0 flex-1 rounded-lg border border-line bg-surface px-3 py-2 text-sm text-ink placeholder:text-ink-subtle focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/20"
            />
            <button
              type="button"
              onClick={() => setTheme(txn.id, themeInput.trim())}
              disabled={themeInput.trim() === txn.theme}
              className="shrink-0 rounded-lg bg-brand px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-brand/90 disabled:cursor-not-allowed disabled:opacity-40"
            >
              保存
            </button>
          </div>
          <p className="mt-1 text-[11px] text-ink-subtle">
            设了主题的账单会出现在看板的「主题」视图里
          </p>

          {/* 配图 */}
          <div className="mt-3 flex items-center gap-3">
            {txn.coverImage ? (
              <img
                src={txn.coverImage}
                alt="账单配图"
                width={128}
                height={128}
                className="h-16 w-16 shrink-0 rounded-lg object-cover"
              />
            ) : (
              <span className="flex h-16 w-16 shrink-0 items-center justify-center rounded-lg bg-canvas text-ink-subtle">
                <ImagePlus size={20} aria-hidden="true" />
              </span>
            )}

            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
                className="rounded-lg border border-line px-3 py-1.5 text-xs text-ink transition-colors hover:bg-canvas disabled:opacity-50"
              >
                {uploading ? '上传中…' : txn.coverImage ? '更换配图' : '添加配图'}
              </button>
              {txn.coverImage && (
                <button
                  type="button"
                  onClick={() => setCoverImage(txn.id, '')}
                  className="flex items-center gap-1 rounded-lg border border-line px-3 py-1.5 text-xs text-ink-muted transition-colors hover:bg-expense-soft hover:text-expense"
                >
                  <X size={12} aria-hidden="true" />
                  移除
                </button>
              )}
            </div>

            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handlePickImage}
              className="hidden"
            />
          </div>
        </div>

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
