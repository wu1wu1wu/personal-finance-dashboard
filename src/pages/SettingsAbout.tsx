import { Database, Info, ShieldCheck, TriangleAlert } from 'lucide-react';
import PageHeader from '@/components/ui/PageHeader';

const CARD = 'rounded-2xl border border-line bg-surface p-4';
const SECTION_TITLE = 'mb-3 flex items-center gap-1.5 text-sm font-semibold text-ink';

export default function SettingsAbout() {
  return (
    <div className="space-y-4">
      <PageHeader
        title="关于"
        description="版本、数据存储方式和使用限制。"
        backTo="/settings"
      />

      <section className={CARD}>
        <h2 className={SECTION_TITLE}>
          <Info size={16} className="text-ink-subtle" aria-hidden="true" />
          应用信息
        </h2>
        <div className="space-y-1 text-sm text-ink-muted">
          <p>个人记账看板 v1.0</p>
          <p>支持微信支付账单导入与安卓端自动记账。</p>
        </div>
      </section>

      <section className={CARD}>
        <h2 className={SECTION_TITLE}>
          <ShieldCheck size={16} className="text-income" aria-hidden="true" />
          隐私
        </h2>
        <p className="text-sm leading-6 text-ink-muted">
          交易、预算、规则和设置只保存在本机。应用没有账号系统和后端服务，不会上传账单内容。
        </p>
      </section>

      <section className={CARD}>
        <h2 className={SECTION_TITLE}>
          <Database size={16} className="text-ink-subtle" aria-hidden="true" />
          数据与备份
        </h2>
        <p className="text-sm leading-6 text-ink-muted">
          卸载应用、清除应用数据或更换手机前，请先在“数据管理”中导出 JSON 备份。
        </p>
      </section>

      <section className={CARD}>
        <h2 className={SECTION_TITLE}>
          <TriangleAlert size={16} className="text-alert" aria-hidden="true" />
          使用限制
        </h2>
        <ul className="space-y-2 text-sm leading-6 text-ink-muted">
          <li>微信支付通知通常只包含金额，不包含商户和商品；导入账单后才能补全详情。</li>
          <li>通知监听服务保持连接时会实时读取，不要求支付通知一直停留在通知栏。</li>
          <li>如果系统杀掉了监听服务，且通知随后被删除，安卓无法再补扫这条历史通知。</li>
          <li>部分国产系统需要在应用设置中将电池策略设为“无限制”，避免后台断连。</li>
        </ul>
      </section>
    </div>
  );
}
