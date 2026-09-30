import AutoLedgerSettings from '@/components/settings/AutoLedgerSettings';
import PageHeader from '@/components/ui/PageHeader';
import { useT } from '@/i18n';

export default function SettingsAutoLedger() {
  const { t } = useT();

  return (
    <div className="space-y-4">
      <PageHeader
        title={t('settingsRules.autoLedger.title')}
        description={t('settingsRules.autoLedger.description')}
        backTo="/settings"
      />
      <AutoLedgerSettings />
    </div>
  );
}
