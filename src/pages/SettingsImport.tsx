import { FolderOpen } from 'lucide-react';
import UploadZone from '@/components/transactions/UploadZone';
import PageHeader from '@/components/ui/PageHeader';

export default function SettingsImport() {
  return (
    <div className="space-y-4">
      <PageHeader
        title="账单导入"
        description="导入微信支付账单，自动补全自动记账记录的商户和交易详情。"
        backTo="/settings"
      />

      <section className="rounded-2xl border border-line bg-surface p-4">
        <h2 className="mb-3 flex items-center gap-1.5 text-sm font-semibold text-ink">
          <FolderOpen size={16} className="text-ink-subtle" aria-hidden="true" />
          选择账单文件
        </h2>
        <UploadZone />
        <p className="mt-3 text-xs text-ink-subtle">
          支持 CSV / XLSX · 编码 GBK / UTF-8 · 相同交易单号自动去重
        </p>
      </section>
    </div>
  );
}
