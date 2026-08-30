// ============================================================
// CategoryTag 组件 - 分类标签（点击可修改分类）
// ============================================================

import { useState, useRef, useEffect } from 'react';
import { CATEGORIES } from '@/types';
import { useTransactionStore } from '@/stores/transaction-store';
import { useClassificationStore } from '@/stores/classification-store';

interface CategoryTagProps {
  /** 交易ID */
  transactionId: string;
  /** 当前分类 */
  category: string;
  /** 交易对方（用于反馈学习） */
  counterparty: string;
  /** 商品说明（用于反馈学习） */
  description: string;
  /** 分类来源 */
  source?: 'auto' | 'manual';
  /** 是否可编辑 */
  editable?: boolean;
}

export default function CategoryTag({
  transactionId,
  category,
  counterparty,
  description,
  source = 'auto',
  editable = true,
}: CategoryTagProps) {
  const [open, setOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const updateCategory = useTransactionStore((s) => s.updateCategory);
  const recordFeedback = useClassificationStore((s) => s.recordFeedback);

  const catInfo = CATEGORIES.find((c) => c.name === category) ?? CATEGORIES[CATEGORIES.length - 1];

  // 点击外部关闭下拉
  useEffect(() => {
    if (!open) return;
    const handleClick = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [open]);

  const handleSelect = (newCategory: string) => {
    if (newCategory === category) {
      setOpen(false);
      return;
    }

    // 更新分类
    updateCategory(transactionId, newCategory);

    // 记录反馈（用交易对方和描述中的关键词）
    const text = `${counterparty} ${description}`.toLowerCase();
    // 提取最短的关键词作为反馈
    const words = text.split(/\s+/).filter((w) => w.length >= 2);
    if (words.length > 0) {
      recordFeedback(words[0], newCategory);
    }

    setOpen(false);
  };

  return (
    <div className="relative inline-block" ref={dropdownRef}>
      <button
        onClick={() => editable && setOpen(!open)}
        className={`
          inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium
          transition-colors
          ${editable ? 'cursor-pointer hover:opacity-80' : 'cursor-default'}
        `}
        style={{
          backgroundColor: catInfo.color + '18',
          color: catInfo.color,
        }}
      >
        <span>{catInfo.icon}</span>
        <span>{catInfo.name}</span>
        {source === 'manual' && (
          <span className="ml-0.5 text-[10px] opacity-60">✎</span>
        )}
      </button>

      {/* 分类选择下拉 */}
      {open && (
        <div className="absolute z-20 top-full left-0 mt-1 w-40 bg-white rounded-lg shadow-lg border border-gray-200 py-1 max-h-60 overflow-y-auto">
          {CATEGORIES.filter((c) => c.name !== '待确认').map((cat) => (
            <button
              key={cat.name}
              onClick={() => handleSelect(cat.name)}
              className={`
                w-full text-left px-3 py-1.5 text-sm flex items-center gap-2
                hover:bg-gray-50 transition-colors
                ${cat.name === category ? 'bg-blue-50 text-blue-700' : 'text-gray-700'}
              `}
            >
              <span>{cat.icon}</span>
              <span>{cat.name}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}