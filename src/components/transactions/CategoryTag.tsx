// ============================================================
// CategoryTag - 分类标签（点击可修改分类）
// ============================================================

import { useState, useRef, useEffect } from 'react';
import { Check } from 'lucide-react';
import { CATEGORIES } from '@/types';
import { useTransactionStore } from '@/stores/transaction-store';
import { useClassificationStore } from '@/stores/classification-store';
import { cn } from '@/utils/cn';
import CategoryIcon from '@/components/ui/CategoryIcon';

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
  source?: 'auto' | 'manual' | 'guessed';
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
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', handleClick);
    document.addEventListener('keydown', handleKey);
    return () => {
      document.removeEventListener('mousedown', handleClick);
      document.removeEventListener('keydown', handleKey);
    };
  }, [open]);

  const handleSelect = (newCategory: string) => {
    if (newCategory === category) {
      setOpen(false);
      return;
    }

    updateCategory(transactionId, newCategory);

    // 用交易对方和描述里最靠前的词作为反馈关键词
    const text = `${counterparty} ${description}`.toLowerCase();
    const words = text.split(/\s+/).filter((w) => w.length >= 2);
    if (words.length > 0) {
      recordFeedback(words[0], newCategory);
    }

    setOpen(false);
  };

  return (
    <div className="relative inline-block shrink-0" ref={dropdownRef}>
      <button
        type="button"
        onClick={() => editable && setOpen(!open)}
        aria-expanded={editable ? open : undefined}
        disabled={!editable}
        className={cn(
          'inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-medium',
          editable ? 'cursor-pointer hover:opacity-80' : 'cursor-default',
        )}
        style={{
          backgroundColor: `${catInfo.color}18`,
          color: catInfo.color,
        }}
      >
        <CategoryIcon category={catInfo.name} size={12} />
        <span>{catInfo.name}</span>
        {source === 'guessed' && (
          <span className="ml-0.5 text-[10px] opacity-70" title="按历史习惯推测">
            推测
          </span>
        )}
      </button>

      {open && (
        <div className="absolute left-0 top-full z-20 mt-1 max-h-60 w-40 overflow-y-auto rounded-lg border border-line bg-surface py-1 shadow-lg">
          {CATEGORIES.filter((c) => c.name !== '待确认').map((cat) => (
            <button
              key={cat.name}
              type="button"
              onClick={() => handleSelect(cat.name)}
              className={cn(
                'flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm transition-colors hover:bg-canvas',
                cat.name === category ? 'bg-brand-soft text-brand' : 'text-ink',
              )}
            >
              <CategoryIcon category={cat.name} size={14} />
              <span className="flex-1">{cat.name}</span>
              {cat.name === category && <Check size={13} aria-hidden="true" />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
