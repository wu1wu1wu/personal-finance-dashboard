import AutoLedgerSettings from '@/components/settings/AutoLedgerSettings';
import PageHeader from '@/components/ui/PageHeader';

export default function SettingsAutoLedger() {
  return (
    <div className="space-y-4">
      <PageHeader
        title="自动记账"
        description="管理通知和短信权限，查看捕获状态并配置消息识别规则。"
        backTo="/settings"
      />
      <AutoLedgerSettings />
    </div>
  );
}
