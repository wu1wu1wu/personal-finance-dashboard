import { Database, Info, ShieldCheck, TriangleAlert } from 'lucide-react';
import PageHeader from '@/components/ui/PageHeader';
import { useT } from '@/i18n';

const CARD = 'rounded-2xl border border-line bg-surface p-4';
const SECTION_TITLE = 'mb-3 flex items-center gap-1.5 text-sm font-semibold text-ink';

export default function SettingsAbout() {
  const { t } = useT();

  return (
    <div className="space-y-4">
      <PageHeader
        title={t('settings.about.title')}
        description={t('settings.about.pageDescription')}
        backTo="/settings"
      />

      <section className={CARD}>
        <h2 className={SECTION_TITLE}>
          <Info size={16} className="text-ink-subtle" aria-hidden="true" />
          {t('settings.about.appInfo')}
        </h2>
        <div className="space-y-1 text-sm text-ink-muted">
          <p>{t('settings.about.appTitle')}</p>
          <p>{t('settings.about.appDescription')}</p>
        </div>
      </section>

      <section className={CARD}>
        <h2 className={SECTION_TITLE}>
          <ShieldCheck size={16} className="text-income" aria-hidden="true" />
          {t('settings.about.privacy')}
        </h2>
        <p className="text-sm leading-6 text-ink-muted">{t('settings.about.privacyBody')}</p>
      </section>

      <section className={CARD}>
        <h2 className={SECTION_TITLE}>
          <Database size={16} className="text-ink-subtle" aria-hidden="true" />
          {t('settings.about.dataBackup')}
        </h2>
        <p className="text-sm leading-6 text-ink-muted">{t('settings.about.dataBackupBody')}</p>
      </section>

      <section className={CARD}>
        <h2 className={SECTION_TITLE}>
          <TriangleAlert size={16} className="text-alert" aria-hidden="true" />
          {t('settings.about.limits')}
        </h2>
        <ul className="space-y-2 text-sm leading-6 text-ink-muted">
          <li>{t('settings.about.limits.notification')}</li>
          <li>{t('settings.about.limits.service')}</li>
          <li>{t('settings.about.limits.killed')}</li>
          <li>{t('settings.about.limits.battery')}</li>
        </ul>
      </section>
    </div>
  );
}
