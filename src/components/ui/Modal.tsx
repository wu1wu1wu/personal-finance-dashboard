// ============================================================
// Modal - 统一弹窗（手机底部抽屉 / 桌面居中卡片）
// 基于 Radix Dialog：自带焦点锁定、Esc 关闭、aria 关联和滚动锁
// ============================================================

import type { ReactNode } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { X } from 'lucide-react';
import { cn } from '@/utils/cn';

interface ModalProps {
  /** 受控开关；用条件渲染调用时可省略 */
  open?: boolean;
  onClose: () => void;
  /** 标题，同时作为对话框的无障碍名称 */
  title: string;
  /** 说明文字，同时作为对话框的无障碍描述（必填，避免屏幕阅读器只念标题） */
  description: string;
  /** 标题右侧的次要内容（如金额） */
  headerExtra?: ReactNode;
  /** 主体内容，超出高度时内部滚动 */
  children: ReactNode;
  /** 固定在底部的操作区 */
  footer?: ReactNode;
  className?: string;
}

export default function Modal({
  open = true,
  onClose,
  title,
  description,
  headerExtra,
  children,
  footer,
  className,
}: ModalProps) {
  return (
    <Dialog.Root
      open={open}
      onOpenChange={(next) => {
        if (!next) onClose();
      }}
    >
      <Dialog.Portal>
        <Dialog.Overlay className="pfd-fade-in fixed inset-0 z-50 bg-black/40" />
        <Dialog.Content
          className={cn(
            'pfd-fade-in fixed z-50 flex flex-col bg-surface overflow-hidden',
            // 手机：贴底抽屉，避免单手够不到
            'inset-x-0 bottom-0 max-h-[88dvh] rounded-t-2xl',
            // 桌面：居中卡片
            'sm:inset-x-auto sm:bottom-auto sm:left-1/2 sm:top-1/2',
            'sm:w-[calc(100%-2rem)] sm:max-w-md sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-2xl',
            className,
          )}
          // 抽屉内滚动到底不要把页面一起带走
          style={{ overscrollBehavior: 'contain' }}
        >
          {/* 手机抽屉顶部的小把手 */}
          <div className="mx-auto mt-2 h-1 w-9 shrink-0 rounded-full bg-line sm:hidden" />

          <header className="flex shrink-0 items-start justify-between gap-3 px-5 pb-3 pt-3">
            <div className="min-w-0">
              <Dialog.Title className="text-base font-semibold text-ink">{title}</Dialog.Title>
              <Dialog.Description className="mt-0.5 text-xs text-ink-subtle">
                {description}
              </Dialog.Description>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              {headerExtra}
              <Dialog.Close asChild>
                <button
                  type="button"
                  aria-label="关闭"
                  className="-mr-1.5 -mt-0.5 flex h-9 w-9 items-center justify-center rounded-lg text-ink-subtle hover:bg-canvas hover:text-ink"
                >
                  <X size={18} aria-hidden="true" />
                </button>
              </Dialog.Close>
            </div>
          </header>

          <div className="min-h-0 flex-1 overflow-y-auto px-5 pb-4">{children}</div>

          {footer && (
            <div className="shrink-0 border-t border-line px-5 pb-[max(1rem,env(safe-area-inset-bottom))] pt-3">
              {footer}
            </div>
          )}

          {!footer && (
            <div className="h-[max(0.75rem,env(safe-area-inset-bottom))] shrink-0" />
          )}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
