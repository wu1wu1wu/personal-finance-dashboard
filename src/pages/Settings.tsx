// ============================================================
// 设置页 - 账单导入 / 自动记账 / 分类规则 / 数据管理
// ============================================================

import { useEffect, useState } from 'react';
import {
  Database,
  Download,
  FolderOpen,
  Info,
  Tags,
  TriangleAlert,
  Upload,
} from 'lucide-react';
import UploadZone from '@/components/transactions/UploadZone';
import CategoryRuleEditor from '@/components/settings/CategoryRuleEditor';
import AutoLedgerSettings from '@/components/settings/AutoLedgerSettings';
import { useTransactionStore } from '@/stores/transaction-store';
import { useClassificationStore } from '@/stores/classification-store';
import { useBudgetStore } from '@/stores/budget-store';
import { storage } from '@/storage/StorageAdapter';
import { cn } from '@/utils/cn';

const CARD = 'rounded-2xl border border-line bg-surface p-4';
const SECTION_TITLE = 'mb-3 flex items-center gap-1.5 text-sm font-semibold text-ink';

export default function Settings() {
  const { transactions, clearAll: clearTransactions, loadFromStorage: loadTransactions } =
    useTransactionStore();
  const { customRules, loadFromStorage: loadRules } = useClassificationStore();
  const { budgets, totalBudgets, loadFromStorage: loadBudgets } = useBudgetStore();

  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [exportStatus, setExportStatus] = useState<string | null>(null);
  const [importStatus, setImportStatus] = useState<string | null>(null);

  // 直接打开或刷新 /settings 时也要把三个 store 读进来，
  // 否则「数据统计」会显示成 0。
  useEffect(() => {
    void loadTransactions();
    void loadRules();
    void loadBudgets();
  }, [loadTransactions, loadRules, loadBudgets]);

  /** 把全部 pfd_ 前缀的存储导出为 JSON 文件 */
  const handleExport = async () => {
    try {
      setExportStatus('正在导出…');
      const backup: Record<string, unknown> = {};

      const keys = await storage.keys();
      for (const key of keys) {
        const data = await storage.get(key);
        if (data !== null) {
          backup[key] = data;
        }
      }

      backup._meta = {
        exportTime: new Date().toISOString(),
        version: '1.0',
        keys,
      };

      const json = JSON.stringify(backup, null, 2);
      const blob = new Blob([json], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `记账备份_${new Date().toISOString().substring(0, 10)}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      setExportStatus('导出成功');
      setTimeout(() => setExportStatus(null), 3000);
    } catch (e) {
      setExportStatus(`导出失败：${e instanceof Error ? e.message : '未知错误'}`);
    }
  };

  /** 从 JSON 备份恢复数据 */
  const handleImportBackup = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setImportStatus('正在恢复…');
      const text = await file.text();
      const backup = JSON.parse(text) as Record<string, unknown>;

      if (!backup._meta || typeof backup._meta !== 'object') {
        throw new Error('无效的备份文件格式');
      }

      const meta = backup._meta as { version: string; keys: string[] };
      if (meta.version !== '1.0') {
        throw new Error(`不支持的备份版本：${meta.version}`);
      }

      let restoredCount = 0;
      for (const key of meta.keys) {
        if (backup[key] !== undefined) {
          await storage.set(key, backup[key]);
          restoredCount++;
        }
      }

      setImportStatus(`恢复成功，已还原 ${restoredCount} 项数据，页面即将刷新…`);
      setTimeout(() => window.location.reload(), 2000);
    } catch (err) {
      setImportStatus(`恢复失败：${err instanceof Error ? err.message : '未知错误'}`);
      setTimeout(() => setImportStatus(null), 5000);
    }

    e.target.value = '';
  };

  const handleClearAll = async () => {
    try {
      await clearTransactions();
      await storage.clear();
      setShowClearConfirm(false);
      window.location.reload();
    } catch (e) {
      console.error('清除数据失败:', e);
    }
  };

  const statTiles = [
    { label: '交易记录', value: transactions.length, tone: 'text-brand bg-brand-soft' },
    { label: '自定义规则', value: customRules.length, tone: 'text-ink bg-canvas' },
    { label: '分类预算', value: budgets.length, tone: 'text-ink bg-canvas' },
    {
      label: '预算月份',
      value: Object.keys(totalBudgets).length,
      tone: 'text-ink bg-canvas',
    },
  ];

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold text-ink">设置</h1>

      {/* 账单导入 */}
      <section className={CARD}>
        <h2 className={SECTION_TITLE}>
          <FolderOpen size={16} className="text-ink-subtle" aria-hidden="true" />
          账单导入
        </h2>
        <UploadZone />
        <p className="mt-3 text-xs text-ink-subtle">
          支持 CSV / XLSX · 编码 GBK / UTF-8 · 相同交易单号自动去重
        </p>
      </section>

      <AutoLedgerSettings />

      {/* 分类规则 */}
      <section className={CARD}>
        <h2 className={SECTION_TITLE}>
          <Tags size={16} className="text-ink-subtle" aria-hidden="true" />
          分类规则
        </h2>
        <CategoryRuleEditor />
      </section>

      {/* 数据统计 */}
      <section className={CARD}>
        <h2 className={SECTION_TITLE}>
          <Database size={16} className="text-ink-subtle" aria-hidden="true" />
          数据统计
        </h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {statTiles.map((tile) => (
            <div key={tile.label} className={cn('rounded-lg p-3 text-center', tile.tone)}>
              <p className="tnum text-xl font-semibold">{tile.value}</p>
              <p className="mt-1 text-xs opacity-80">{tile.label}</p>
            </div>
          ))}
        </div>
      </section>

      {/* 备份与恢复 */}
      <section className={CARD}>
        <h2 className={SECTION_TITLE}>
          <Download size={16} className="text-ink-subtle" aria-hidden="true" />
          数据备份与恢复
        </h2>
        <p className="mb-4 text-sm text-ink-muted">
          所有数据只存在本机，不会发送到任何服务器。换机或清缓存前建议先导出备份。
        </p>
        <div className="flex flex-wrap gap-3">
          <button
            type="button"
            onClick={handleExport}
            disabled={transactions.length === 0}
            className="flex items-center gap-1.5 rounded-lg bg-brand px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-brand/90 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Download size={15} aria-hidden="true" />
            导出备份
          </button>

          <label className="flex cursor-pointer items-center gap-1.5 rounded-lg border border-line px-4 py-2 text-sm font-medium text-ink transition-colors hover:bg-canvas">
            <Upload size={15} aria-hidden="true" />
            恢复备份
            <input type="file" accept=".json" onChange={handleImportBackup} className="hidden" />
          </label>
        </div>

        {exportStatus && (
          <p role="status" aria-live="polite" className="mt-3 text-sm text-brand">
            {exportStatus}
          </p>
        )}
        {importStatus && (
          <p role="status" aria-live="polite" className="mt-3 text-sm text-income">
            {importStatus}
          </p>
        )}
      </section>

      {/* 清除数据 */}
      <section className="rounded-2xl border border-line bg-surface p-4">
        <h2 className="mb-3 flex items-center gap-1.5 text-sm font-semibold text-expense">
          <TriangleAlert size={16} aria-hidden="true" />
          清除数据
        </h2>
        <p className="mb-4 text-sm text-ink-muted">
          清除本机保存的交易记录、分类规则和预算设置。此操作不可撤销。
        </p>

        {!showClearConfirm ? (
          <button
            type="button"
            onClick={() => setShowClearConfirm(true)}
            className="rounded-lg border border-expense-soft px-4 py-2 text-sm text-expense transition-colors hover:bg-expense-soft"
          >
            清除所有数据
          </button>
        ) : (
          <div className="rounded-lg bg-expense-soft p-4">
            <p className="mb-3 text-sm font-medium text-expense">
              确定要清除所有数据吗？此操作不可撤销。
            </p>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={handleClearAll}
                className="rounded-lg bg-expense px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-expense/90"
              >
                确认清除
              </button>
              <button
                type="button"
                onClick={() => setShowClearConfirm(false)}
                className="rounded-lg border border-line bg-surface px-4 py-2 text-sm text-ink transition-colors hover:bg-canvas"
              >
                取消
              </button>
            </div>
          </div>
        )}
      </section>

      {/* 关于 */}
      <section className={CARD}>
        <h2 className={SECTION_TITLE}>
          <Info size={16} className="text-ink-subtle" aria-hidden="true" />
          关于
        </h2>
        <div className="space-y-1 text-sm text-ink-muted">
          <p>个人记账看板 v1.0</p>
          <p>数据仅存储在本机，保护隐私</p>
          <p>支持微信支付账单导入（CSV / XLSX 格式）</p>
        </div>
      </section>
    </div>
  );
}
