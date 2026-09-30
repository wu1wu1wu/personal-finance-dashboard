import { FolderOpen } from 'lucide-react';
import UploadZone from '@/components/transactions/UploadZone';
import PageHeader from '@/components/ui/PageHeader';
import { useT } from '@/i18n';

export default function SettingsImport() {
  const { t } = useT();

  return (
    <div className="space-y-4">
      <PageHeader
        title={t('billImport.title')}
        description={t('billImport.page.description')}
        backTo="/settings"
      />

      <section className="rounded-2xl border border-line bg-surface p-4">
        <h2 className="mb-3 flex items-center gap-1.5 text-sm font-semibold text-ink">
          <FolderOpen size={16} className="text-ink-subtle" aria-hidden="true" />
          {t('billImport.chooseFile')}
        </h2>
        <UploadZone />
        <p className="mt-3 text-xs text-ink-subtle">{t('billImport.page.formats')}</p>
      </section>

      {/* 导出入口藏得很深，直接写清楚省得用户到处找 */}
      <section className="rounded-2xl border border-line bg-surface p-4">
        <h2 className="text-sm font-semibold text-ink">{t('billImport.howto.title')}</h2>
        <ul className="mt-2 space-y-2 text-xs leading-relaxed text-ink-muted">
          <li>{t('billImport.howto.wechat')}</li>
          <li>{t('billImport.howto.alipay')}</li>
        </ul>
        <p className="mt-3 text-xs text-ink-subtle">{t('billImport.howto.note')}</p>
      </section>
    </div>
  );
}
