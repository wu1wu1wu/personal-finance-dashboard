// ============================================================
// TransactionCard - 封面卡片
//
// 只在「封面」视图使用，且只渲染真正有封面图的记录，
// 避免出现一整屏没有内容的灰色占位块。
// ============================================================

import { useRef, useState } from 'react';
import { ImagePlus, X } from 'lucide-react';
import type { Transaction } from '@/types';
import { CATEGORIES } from '@/types';
import { useTransactionStore } from '@/stores/transaction-store';
import { formatCurrency, formatDateShort } from '@/utils/format';
import { compressImage } from '@/utils/image';
import { cn } from '@/utils/cn';

interface TransactionCardProps {
  txn: Transaction;
  onClick?: () => void;
}

export default function TransactionCard({ txn, onClick }: TransactionCardProps) {
  const setCoverImage = useTransactionStore((s) => s.setCoverImage);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  const cat = CATEGORIES.find((c) => c.name === txn.category) ?? CATEGORIES[CATEGORIES.length - 1];
  const isExpense = txn.amount > 0;
  const isTransfer = !isExpense && txn.transactionType === '其他';

  const openPicker = () => fileInputRef.current?.click();

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const dataUrl = await compressImage(file);
      setCoverImage(txn.id, dataUrl);
    } catch (err) {
      console.error('封面上传失败:', err);
    } finally {
      setUploading(false);
      e.target.value = '';
    }
  };

  const handleRemoveCover = (e: React.MouseEvent) => {
    e.stopPropagation();
    setCoverImage(txn.id, '');
  };

  return (
    <div className="group relative overflow-hidden rounded-xl border border-line bg-surface transition-shadow hover:shadow-md">
      <button
        type="button"
        onClick={onClick}
        className="block w-full text-left"
        aria-label={`${txn.counterparty || txn.description || '交易'}，${formatCurrency(Math.abs(txn.amount))}`}
      >
        {/* 封面图 */}
        <div className="relative aspect-[4/3] overflow-hidden bg-canvas">
          {txn.coverImage ? (
            <img
              src={txn.coverImage}
              alt=""
              width={400}
              height={300}
              loading="lazy"
              className="h-full w-full object-cover"
            />
          ) : (
            <div
              className="flex h-full w-full items-center justify-center"
              style={{ backgroundColor: `${cat.color}14` }}
            >
              <ImagePlus size={22} className="text-ink-subtle" aria-hidden="true" />
            </div>
          )}
        </div>

        {/* 信息区 */}
        <div className="p-2.5">
          <p className="truncate text-sm font-medium text-ink">
            {txn.counterparty || '未知交易'}
          </p>
          <p className="mt-0.5 truncate text-[11px] text-ink-subtle">
            {txn.category} · {formatDateShort(txn.transactionTime)}
          </p>
          <p
            className={cn(
              'tnum mt-1 whitespace-nowrap text-sm font-semibold',
              isExpense ? 'text-expense' : isTransfer ? 'text-ink-muted' : 'text-income',
            )}
          >
            {isExpense ? '-' : '+'}
            {formatCurrency(Math.abs(txn.amount))}
          </p>
        </div>
      </button>

      {/* 更换封面：悬停时才出现在桌面端，移动端靠删除按钮旁边的入口 */}
      <button
        type="button"
        onClick={openPicker}
        aria-label={txn.coverImage ? '更换封面' : '添加封面'}
        className="absolute right-1.5 top-1.5 flex h-7 w-7 items-center justify-center rounded-full bg-black/45 text-white opacity-0 transition-opacity hover:bg-black/65 focus-visible:opacity-100 group-hover:opacity-100"
      >
        <ImagePlus size={14} aria-hidden="true" />
      </button>

      {/* 删除封面：始终可见，移动端没有 hover */}
      {txn.coverImage && (
        <button
          type="button"
          onClick={handleRemoveCover}
          aria-label="删除封面"
          className="absolute right-1.5 top-10 flex h-7 w-7 items-center justify-center rounded-full bg-black/45 text-white transition-colors hover:bg-expense"
        >
          <X size={14} aria-hidden="true" />
        </button>
      )}

      {uploading && (
        <div className="absolute inset-0 flex items-center justify-center bg-surface/80 text-xs text-ink-muted">
          上传中…
        </div>
      )}

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={handleFileChange}
        className="hidden"
      />
    </div>
  );
}
