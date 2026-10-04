// ============================================================
// TransactionCard - 手记卡片
//
// 一笔账单在手记视图里的样子：可以是一句话、一张图，或者两者都有。
// 卡片上就能改字、换图、整条移出，不用跳进详情页。
//
// 结构上没有用「整个卡片套一个按钮」：那样卡片里放不了输入框。
// 改成一张铺满卡片的透明按钮负责进详情，内容层压在它上面
// （和明细列表行同一套写法）。
// ============================================================

import { useRef, useState } from 'react';
import { ImagePlus, Trash2, X } from 'lucide-react';
import type { Transaction } from '@/types';
import { CATEGORIES } from '@/types';
import { TRANSFER_CATEGORY } from '@/core/transaction-query';
import { NOTE_MAX_LENGTH } from '@/core/transaction-note';
import { formatAmountCompact } from '@/utils/format';
import { compressImage } from '@/utils/image';
import { categoryLabel, formatDateTimeForLocale, useLocale, useT } from '@/i18n';
import { cn } from '@/utils/cn';
import CategoryIcon from '@/components/ui/CategoryIcon';

interface TransactionCardProps {
  txn: Transaction;
  /** 点击卡片空白处：跳到明细页打开这笔 */
  onClick?: () => void;
  /** 保存手记文字（空字符串 = 清空） */
  onNoteChange?: (note: string) => void;
  /** 加图 / 换图 / 删图（空字符串 = 删图） */
  onCoverChange?: (coverImage: string) => void;
  /** 移出整条手记：文字与配图一起清，卡片随之消失 */
  onClearNote?: () => void;
}

export default function TransactionCard({
  txn,
  onClick,
  onNoteChange,
  onCoverChange,
  onClearNote,
}: TransactionCardProps) {
  const { t } = useT();
  const locale = useLocale();
  const cat = CATEGORIES.find((c) => c.name === txn.category) ?? CATEGORIES[CATEGORIES.length - 1];
  const isExpense = txn.amount > 0;
  const isTransfer = txn.category === TRANSFER_CATEGORY;
  const hasImage = Boolean(txn.coverImage);

  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(txn.theme);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  // 点「取消」时先吞掉这次失焦，否则 blur 会抢先把输入框里的内容存下去
  const cancelRef = useRef(false);

  const name = txn.counterparty || txn.description;
  const title = txn.theme || name || t('transactions.untitled');
  // 没有手记时，标题就是交易对方；副标题再重复一遍没有意义，只在有商品说明时补一行
  const subtitle = txn.theme
    ? txn.counterparty || txn.description
    : txn.counterparty && txn.description
      ? txn.description
      : '';

  const amountColor = isTransfer ? 'text-ink-muted' : isExpense ? 'text-expense' : 'text-income';
  const amountCircleStyle = hasImage ? undefined : { backgroundColor: `${cat.color}14`, color: cat.color };

  /** 卡片上的小按钮：有配图时走半透明深色底，否则走浅色 */
  const chipClass = cn(
    'pointer-events-auto inline-flex min-h-11 items-center gap-1 rounded-lg border px-2.5 text-xs transition-colors',
    hasImage
      ? 'border-white/40 bg-black/35 text-white hover:bg-black/55'
      : 'border-line bg-surface text-ink-muted hover:bg-canvas hover:text-ink',
  );

  const startEdit = () => {
    setDraft(txn.theme);
    cancelRef.current = false;
    setEditing(true);
  };

  const cancelEdit = () => {
    cancelRef.current = true;
    setEditing(false);
  };

  const saveEdit = () => {
    if (cancelRef.current) {
      cancelRef.current = false;
      return;
    }
    setEditing(false);
    onNoteChange?.(draft);
  };

  const handlePickImage = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const dataUrl = await compressImage(file);
      onCoverChange?.(dataUrl);
    } catch (err) {
      console.error('手记配图上传失败:', err);
    } finally {
      setUploading(false);
      e.target.value = '';
    }
  };

  return (
    <li className="relative">
      {/* 进详情：铺满卡片的透明按钮。编辑时撤掉，免得点一下空白就把人带走 */}
      {!editing && (
        <button
          type="button"
          onClick={onClick}
          aria-label={t('transactions.viewDetail', { name: title })}
          className="absolute inset-0 z-0 rounded-2xl"
        />
      )}

      <div
        className={cn(
          'relative z-10 overflow-hidden rounded-2xl border',
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

        <div className="pointer-events-none relative p-4">
          {/* 金额 + 手记 */}
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
              <span className="mt-0.5 text-[10px] opacity-80">{t('common.yuan')}</span>
            </span>

            <div className="min-w-0 flex-1">
              {editing ? (
                <input
                  autoFocus
                  type="text"
                  value={draft}
                  maxLength={NOTE_MAX_LENGTH}
                  onChange={(e) => setDraft(e.target.value)}
                  onBlur={saveEdit}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      saveEdit();
                    } else if (e.key === 'Escape') {
                      e.preventDefault();
                      cancelEdit();
                    }
                  }}
                  placeholder={t('transactions.note.placeholder')}
                  aria-label={t('transactions.field.theme')}
                  className={cn(
                    'pointer-events-auto w-full rounded-lg border px-3 py-2 text-base font-medium',
                    hasImage
                      ? 'border-white/40 bg-black/45 text-white placeholder:text-white/70'
                      : 'border-line bg-surface text-ink placeholder:text-ink-subtle focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/20',
                  )}
                />
              ) : (
                <button
                  type="button"
                  onClick={startEdit}
                  disabled={!onNoteChange}
                  aria-label={t('transactions.note.editNamed', { name: title })}
                  className="pointer-events-auto block w-full rounded-lg text-left disabled:cursor-default"
                >
                  <span
                    className={cn(
                      // 手记是用户随手写的，最长限制在 3 行，否则会把卡片撑高、压掉配图的渐变
                      'line-clamp-3 block text-base font-medium',
                      hasImage ? 'text-white' : 'text-ink',
                    )}
                  >
                    {title}
                  </span>
                </button>
              )}

              {!editing && subtitle && (
                <span
                  className={cn(
                    'mt-0.5 block truncate text-xs',
                    hasImage ? 'text-white/85' : 'text-ink-subtle',
                  )}
                >
                  {subtitle}
                </span>
              )}
            </div>
          </div>

          {/* 平时是分类 + 时间；编辑时这一行换成配图与保存/取消 */}
          {editing ? (
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
                className={cn(chipClass, 'disabled:opacity-60')}
              >
                <ImagePlus size={13} aria-hidden="true" />
                {uploading
                  ? t('transactions.detail.uploading')
                  : hasImage
                    ? t('transactions.note.replaceCover')
                    : t('transactions.note.addCover')}
              </button>

              {hasImage && (
                <button
                  type="button"
                  onClick={() => onCoverChange?.('')}
                  className={cn(chipClass, 'hover:text-expense')}
                >
                  <Trash2 size={13} aria-hidden="true" />
                  {t('transactions.note.removeCover')}
                </button>
              )}

              <span className="ml-auto flex items-center gap-2">
                <button
                  type="button"
                  onClick={saveEdit}
                  className="pointer-events-auto inline-flex min-h-11 items-center rounded-lg bg-brand px-3 text-xs font-medium text-white transition-colors hover:bg-brand/90"
                >
                  {t('common.save')}
                </button>
                <button
                  type="button"
                  // 先 preventDefault 挡住失焦，否则「取消」会先被 blur 存成保存
                  onPointerDown={(e) => {
                    e.preventDefault();
                    cancelEdit();
                  }}
                  onClick={cancelEdit}
                  className={cn(
                    'pointer-events-auto inline-flex min-h-11 items-center rounded-lg px-3 text-xs transition-colors',
                    hasImage
                      ? 'bg-black/35 text-white hover:bg-black/55'
                      : 'bg-canvas text-ink-muted hover:text-ink',
                  )}
                >
                  {t('common.cancel')}
                </button>
              </span>

              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handlePickImage}
                className="hidden"
              />
            </div>
          ) : (
            <div
              className={cn(
                'mt-3 flex items-center justify-between gap-3 text-xs',
                hasImage ? 'text-white/80' : 'text-ink-subtle',
              )}
            >
              <span className="inline-flex items-center gap-1 truncate">
                <CategoryIcon category={txn.category} size={12} />
                {categoryLabel(locale, txn.category)}
              </span>
              <span className="shrink-0 tnum">
                {formatDateTimeForLocale(locale, txn.transactionTime)}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* 移出手记：文字与配图一起清。编辑时不出现，避免手滑 */}
      {!editing && onClearNote && (
        <button
          type="button"
          onClick={onClearNote}
          aria-label={t('transactions.note.remove')}
          className={cn(
            // 视觉上仍是一个小圆钮，但点击区扩到 44px
            'absolute right-1 top-1 z-20 flex h-11 w-11 items-center justify-center rounded-full transition-colors',
            hasImage
              ? 'text-white hover:bg-expense'
              : 'text-ink-subtle hover:bg-expense-soft hover:text-expense',
          )}
        >
          <span
            className={cn(
              'flex h-7 w-7 items-center justify-center rounded-full',
              hasImage ? 'bg-black/45' : 'bg-canvas',
            )}
          >
            <X size={13} aria-hidden="true" />
          </span>
        </button>
      )}
    </li>
  );
}
