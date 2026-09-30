import CategoryRuleEditor from '@/components/settings/CategoryRuleEditor';
import PageHeader from '@/components/ui/PageHeader';
import { useT } from '@/i18n';

export default function SettingsCategories() {
  const { t } = useT();

  return (
    <div className="space-y-4">
      <PageHeader
        title={t('settingsRules.title')}
        description={t('settingsRules.description')}
        backTo="/settings"
      />
      <section className="rounded-2xl border border-line bg-surface p-4">
        <CategoryRuleEditor />
      </section>
    </div>
  );
}
