// ============================================================
// PersistAlert - 数据没写进磁盘时的常驻告警
//
// 过去存储写失败是无人接管的 Promise：界面显示"已保存"，刷新后回退。
// 这条横幅是最后一道防线——宁可打扰用户，也不能让他以为数据安全。
// ============================================================

import { Link } from 'react-router-dom';
import { TriangleAlert } from 'lucide-react';
import { usePersistStatus } from '@/storage/persist-queue';

export default function PersistAlert() {
  const error = usePersistStatus((s) => s.error);
  if (!error) return null;

  return (
    <div
      role="alert"
      className="border-b border-expense-soft bg-expense-soft px-4 py-2.5 text-expense"
    >
      <div className="mx-auto flex max-w-5xl items-start gap-2.5">
        <TriangleAlert size={16} className="mt-0.5 shrink-0" aria-hidden="true" />
        <p className="min-w-0 flex-1 text-sm">
          <span className="font-medium">数据没能保存到本机：</span>
          {error}
        </p>
        <Link
          to="/settings/data"
          className="shrink-0 whitespace-nowrap text-sm font-medium underline"
        >
          去导出备份
        </Link>
      </div>
    </div>
  );
}
