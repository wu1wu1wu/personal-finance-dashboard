import CategoryRuleEditor from '@/components/settings/CategoryRuleEditor';
import PageHeader from '@/components/ui/PageHeader';

export default function SettingsCategories() {
  return (
    <div className="space-y-4">
      <PageHeader
        title="分类规则"
        description="关键词命中的交易会优先归入你指定的分类。"
        backTo="/settings"
      />
      <section className="rounded-2xl border border-line bg-surface p-4">
        <CategoryRuleEditor />
      </section>
    </div>
  );
}
