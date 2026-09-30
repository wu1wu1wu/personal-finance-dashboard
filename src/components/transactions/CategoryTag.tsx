// ============================================================
// CategoryTag - 分类标签，点击可改分类
//
// 用 Radix DropdownMenu 而不是自己写绝对定位的浮层：
// 菜单渲染到 body（portal），不会被后面的列表行盖住；
// 自带碰撞检测，靠近屏幕底部时自动向上弹，并按可用高度滚动。
// ============================================================

import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
import { Check } from 'lucide-react';
import { CATEGORIES } from '@/types';
import { useTransactionStore } from '@/stores/transaction-store';
import { useClassificationStore } from '@/stores/classification-store';
import { categoryLabel, useLocale, useT } from '@/i18n';
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
  source?: 'auto' | 'rule' | 'manual' | 'guessed';
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
  const updateCategory = useTransactionStore((s) => s.updateCategory);
  const recordFeedback = useClassificationStore((s) => s.recordFeedback);
  const { t } = useT();
  const locale = useLocale();

  const catInfo = CATEGORIES.find((c) => c.name === category) ?? CATEGORIES[CATEGORIES.length - 1];

  // min-h-8：行内的文字 chip 按「密集列表」规则给到 32px（WCAG 2.2 目标尺寸的间距例外）
  const tagClass =
    'inline-flex min-h-8 items-center gap-1 whitespace-nowrap rounded-full px-2 text-xs font-medium';
  const tagStyle = { backgroundColor: `${catInfo.color}18`, color: catInfo.color };

  const tagContent = (
    <>
      <CategoryIcon category={catInfo.name} size={12} />
      <span>{categoryLabel(locale, catInfo.name)}</span>
      {source === 'guessed' && (
        <span
          className="ml-0.5 text-[10px] opacity-70"
          title={t('transactions.tag.guessedTitle')}
        >
          {t('transactions.tag.guessed')}
        </span>
      )}
      {source === 'rule' && (
        <span className="ml-0.5 text-[10px] opacity-70" title={t('transactions.tag.ruleTitle')}>
          {t('transactions.tag.rule')}
        </span>
      )}
    </>
  );

  // 不可编辑时直接渲染静态标签，不挂菜单
  if (!editable) {
    return (
      <span className={cn(tagClass, 'cursor-default')} style={tagStyle}>
        {tagContent}
      </span>
    );
  }

  const handleSelect = (newCategory: string) => {
    if (newCategory === category) return;

    updateCategory(transactionId, newCategory);

    // 用交易对方和描述里最靠前的词作为反馈关键词
    const text = `${counterparty} ${description}`.toLowerCase();
    const words = text.split(/\s+/).filter((w) => w.length >= 2);
    if (words.length > 0) {
      recordFeedback(words[0], newCategory);
    }
  };

  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger asChild>
        <button type="button" className={cn(tagClass, 'cursor-pointer hover:opacity-80')} style={tagStyle}>
          {tagContent}
        </button>
      </DropdownMenu.Trigger>

      <DropdownMenu.Portal>
        <DropdownMenu.Content
          align="start"
          side="bottom"
          sideOffset={4}
          collisionPadding={12}
          className={cn(
            'pfd-fade-in z-50 min-w-[9rem] overflow-y-auto rounded-lg border border-line bg-surface py-1 shadow-lg',
            // Radix 会把可用的垂直空间写进这个变量，避免菜单超出屏幕
            'max-h-[var(--radix-dropdown-menu-content-available-height)]',
          )}
          style={{ overscrollBehavior: 'contain' }}
        >
          <DropdownMenu.RadioGroup value={category} onValueChange={handleSelect}>
            {CATEGORIES.filter((c) => c.name !== '待确认').map((cat) => (
              <DropdownMenu.RadioItem
                key={cat.name}
                value={cat.name}
                className={cn(
                  'flex cursor-pointer items-center gap-2 px-3 py-2 text-sm outline-none',
                  'data-[highlighted]:bg-canvas',
                  cat.name === category ? 'text-brand' : 'text-ink',
                )}
              >
                <CategoryIcon category={cat.name} size={14} />
                <span className="flex-1">{categoryLabel(locale, cat.name)}</span>
                <DropdownMenu.ItemIndicator>
                  <Check size={13} aria-hidden="true" />
                </DropdownMenu.ItemIndicator>
              </DropdownMenu.RadioItem>
            ))}
          </DropdownMenu.RadioGroup>
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}
