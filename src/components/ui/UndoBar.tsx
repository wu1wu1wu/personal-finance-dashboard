// ============================================================
// UndoBar - 删除后的撤销条
//
// 8 秒内可以点「撤销」把刚删的东西拿回来；到点自动消失（数据仍在回收站里，
// 设置页的「最近删除」还能找回）。
// ============================================================

import { useEffect } from 'react';
import { Undo2, X } from 'lucide-react';

interface UndoBarProps {
  /** 提示文案，如「已删除 3 笔」 */
  label: string;
  onUndo: () => void;
  onDismiss: () => void;
  /** 停留时长（毫秒） */
  duration?: number;
}

export default function UndoBar({ label, onUndo, onDismiss, duration = 8000 }: UndoBarProps) {
  useEffect(() => {
    const timer = setTimeout(onDismiss, duration);
    return () => clearTimeout(timer);
  }, [duration, onDismiss, label]);

  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed inset-x-0 bottom-[calc(4.25rem+env(safe-area-inset-bottom))] z-40 px-4 md:bottom-4"
    >
      <div className="mx-auto flex max-w-md items-center gap-3 rounded-xl border border-line bg-surface p-3 shadow-lg">
        <span className="min-w-0 flex-1 text-sm text-ink-muted">{label}</span>

        <button
          type="button"
          onClick={onUndo}
          className="flex min-h-11 items-center gap-1.5 rounded-lg bg-brand px-3 text-sm font-medium text-white transition-colors hover:bg-brand/90"
        >
          <Undo2 size={15} aria-hidden="true" />
          撤销
        </button>

        <button
          type="button"
          onClick={onDismiss}
          aria-label="关闭提示"
          className="flex min-h-11 min-w-11 items-center justify-center rounded-lg text-ink-subtle transition-colors hover:text-ink"
        >
          <X size={16} aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}
