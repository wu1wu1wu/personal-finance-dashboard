// ============================================================
// TransactionCard 组件 - 首页交易卡片（含封面图）
// ============================================================

import { useRef, useState } from 'react';
import type { Transaction } from '@/types';
import { CATEGORIES } from '@/types';
import { useTransactionStore } from '@/stores/transaction-store';
import { formatCurrency, formatDateShort } from '@/utils/format';
import { compressImage } from '@/utils/image';

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

  const handleCoverClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    fileInputRef.current?.click();
  };

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
    <div
      onClick={onClick}
      className="bg-white rounded-xl border border-gray-100 overflow-hidden hover:shadow-md transition-shadow cursor-pointer group"
    >
      {/* 封面区域 */}
      <div
        className="relative h-32 bg-gray-100 flex items-center justify-center overflow-hidden"
        onClick={handleCoverClick}
        title="点击更换封面"
      >
        {txn.coverImage ? (
          <img
            src={txn.coverImage}
            alt=""
            className="w-full h-full object-cover"
          />
        ) : (
          <div
            className="w-full h-full flex items-center justify-center text-4xl opacity-30"
            style={{ backgroundColor: cat.color + '20' }}
          >
            {cat.icon}
          </div>
        )}
        {/* 上传/更换遮罩 */}
        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 flex items-center justify-center transition-colors">
          <span className="text-white text-xs bg-black/50 px-2 py-1 rounded-full opacity-0 group-hover:opacity-100 transition-opacity">
            {uploading ? '上传中...' : txn.coverImage ? '更换封面' : '添加封面'}
          </span>
        </div>
        {/* 删除封面按钮（移动端无 hover，故始终可见） */}
        {txn.coverImage && (
          <button
            onClick={handleRemoveCover}
            className="absolute top-1.5 right-1.5 w-6 h-6 flex items-center justify-center rounded-full bg-black/50 text-white text-sm leading-none hover:bg-red-500 transition-colors"
            title="删除封面"
          >
            ✕
          </button>
        )}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          onChange={handleFileChange}
          className="hidden"
        />
      </div>

      {/* 信息区域 */}
      <div className="p-3">
        {/* 分类标签 */}
        <span
          className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium mb-2"
          style={{ backgroundColor: cat.color + '15', color: cat.color }}
        >
          {cat.icon} {txn.category}
        </span>

        {/* 交易对方 */}
        <p className="text-sm font-medium text-gray-900 truncate">
          {txn.counterparty || '未知交易'}
        </p>

        {/* 金额 + 日期 */}
        <div className="flex items-center justify-between mt-1.5">
          <span className={`text-base font-bold font-mono ${isExpense ? 'text-red-500' : 'text-green-500'}`}>
            {isExpense ? '-' : '+'}{formatCurrency(Math.abs(txn.amount))}
          </span>
          <span className="text-xs text-gray-400">
            {formatDateShort(txn.transactionTime)}
          </span>
        </div>
      </div>
    </div>
  );
}