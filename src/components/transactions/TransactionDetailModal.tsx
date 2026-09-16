// ============================================================
// TransactionDetailModal - 交易详情弹窗（查看完整信息 + 删除）
// ============================================================

import { useState } from 'react';
import type { Transaction } from '@/types';
import { CATEGORIES } from '@/types';
import { useTransactionStore } from '@/stores/transaction-store';
import CategoryTag from '@/components/transactions/CategoryTag';
import { formatCurrency } from '@/utils/format';

interface TransactionDetailModalProps {
  txn: Transaction;
  onClose: () => void;
}

export default function TransactionDetailModal({ txn, onClose }: TransactionDetailModalProps) {
  const deleteTransaction = useTransactionStore((s) => s.deleteTransaction);
  const [confirming, setConfirming] = useState(false);

  const cat = CATEGORIES.find((c) => c.name === txn.category) ?? CATEGORIES[CATEGORIES.length - 1];
  const isExpense = txn.amount > 0;

  const rows: { label: string; value: string }[] = [
    { label: '交易时间', value: txn.transactionTime || '无' },
    { label: '收支类型', value: txn.transactionType || '无' },
    { label: '交易对方', value: txn.counterparty || '无' },
    { label: '商品说明', value: txn.description || '无' },
    { label: '支付方式', value: txn.paymentMethod || '无' },
    { label: '交易状态', value: txn.paymentStatus || '无' },
    { label: '交易单号', value: txn.transactionNo || '无' },
    { label: '分类来源', value: txn.categorySource === 'manual' ? '手动指定' : '自动识别' },
    { label: '周期交易', value: txn.isPeriodic ? '是' : '否' },
    {
      label: '导入时间',
      value: txn.createdAt ? new Date(txn.createdAt).toLocaleString('zh-CN') : '无',
    },
  ];

  const handleDelete = () => {
    deleteTransaction(txn.id);
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-t-2xl sm:rounded-2xl shadow-xl w-full sm:max-w-md max-h-[88vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* 顶部：分类图标 + 金额 */}
        <div className="p-5 border-b border-gray-100">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-3 min-w-0">
              <div
                className="flex-shrink-0 w-11 h-11 rounded-full flex items-center justify-center text-xl"
                style={{ backgroundColor: cat.color + '20' }}
              >
                {cat.icon}
              </div>
              <div className="min-w-0">
                <p className="font-medium text-gray-900 truncate">
                  {txn.counterparty || txn.description || '未知交易'}
                </p>
                <p className="text-xs text-gray-400">{txn.transactionTime}</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="flex-shrink-0 -mt-1 -mr-1 w-8 h-8 flex items-center justify-center text-gray-400 hover:text-gray-600 text-lg"
              title="关闭"
            >
              ✕
            </button>
          </div>

          <p
            className={`mt-3 text-2xl font-bold font-mono ${
              isExpense ? 'text-red-500' : 'text-green-500'
            }`}
          >
            {isExpense ? '-' : '+'}
            {formatCurrency(Math.abs(txn.amount))}
          </p>
        </div>

        {/* 封面图 */}
        {txn.coverImage && (
          <div className="px-5 pt-4">
            <img src={txn.coverImage} alt="" className="w-full rounded-lg object-cover max-h-48" />
          </div>
        )}

        {/* 分类（可直接修改） */}
        <div className="px-5 py-4 border-b border-gray-100">
          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-500">分类</span>
            <CategoryTag
              transactionId={txn.id}
              category={txn.category}
              counterparty={txn.counterparty}
              description={txn.description}
              source={txn.categorySource}
              editable
            />
          </div>
        </div>

        {/* 详细信息 */}
        <div className="px-5 py-4 space-y-2.5">
          {rows.map((row) => (
            <div key={row.label} className="flex items-start justify-between gap-4">
              <span className="flex-shrink-0 text-sm text-gray-500">{row.label}</span>
              <span className="text-sm text-gray-900 text-right break-all">{row.value}</span>
            </div>
          ))}

          {txn.tags.length > 0 && (
            <div className="flex items-start justify-between gap-4">
              <span className="flex-shrink-0 text-sm text-gray-500">标签</span>
              <span className="flex flex-wrap justify-end gap-1">
                {txn.tags.map((tag) => (
                  <span
                    key={tag}
                    className="px-2 py-0.5 text-xs bg-gray-100 text-gray-600 rounded-full"
                  >
                    {tag}
                  </span>
                ))}
              </span>
            </div>
          )}
        </div>

        {/* 删除操作（二次确认，避免误删） */}
        <div className="px-5 pb-5 pt-1">
          {confirming ? (
            <div className="flex gap-2">
              <button
                onClick={handleDelete}
                className="flex-1 py-2.5 text-sm bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors"
              >
                确认删除
              </button>
              <button
                onClick={() => setConfirming(false)}
                className="flex-1 py-2.5 text-sm bg-gray-100 text-gray-600 rounded-lg hover:bg-gray-200 transition-colors"
              >
                取消
              </button>
            </div>
          ) : (
            <button
              onClick={() => setConfirming(true)}
              className="w-full py-2.5 text-sm text-red-500 border border-red-200 rounded-lg hover:bg-red-50 transition-colors"
            >
              删除这笔交易
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
