import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { CalendarMinus, Database, Download, ShieldCheck, TriangleAlert, Upload } from 'lucide-react';
import { Capacitor } from '@capacitor/core';
import PageHeader from '@/components/ui/PageHeader';
import AutoLedger from '@/plugins/AutoLedger';
import { useTransactionStore } from '@/stores/transaction-store';
import { useClassificationStore } from '@/stores/classification-store';
import { useBudgetStore } from '@/stores/budget-store';
import { useSettingsStore } from '@/stores/settings-store';
import { storage } from '@/storage/StorageAdapter';
import { flushAllPersists } from '@/storage/persist-queue';
import { buildBackup, restoreBackup, snapshotCurrent, validateBackup } from '@/core/backup';
import { maskTransactions } from '@/core/data-masker';
import { STORAGE_KEYS } from '@/types';
import type { Transaction } from '@/types';
import { backupFilename, downloadJsonFile } from '@/utils/download';
import { cn } from '@/utils/cn';

const CARD = 'rounded-2xl border border-line bg-surface p-4';
const SECTION_TITLE = 'mb-3 flex items-center gap-1.5 text-sm font-semibold text-ink';

/** 待确认的恢复请求：先校验、再让用户确认，最后才写盘 */
interface PendingRestore {
  fileName: string;
  backup: unknown;
  keys: string[];
}

export default function SettingsData() {
  const navigate = useNavigate();
  const { transactions, clearAll: clearTransactions, loadFromStorage: loadTransactions } =
    useTransactionStore();
  const { customRules, loadFromStorage: loadRules } = useClassificationStore();
  const { budgets, totalBudgets, loadFromStorage: loadBudgets } = useBudgetStore();
  const { settings, loadFromStorage: loadSettings, setImportDesensitize } = useSettingsStore();

  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [exportStatus, setExportStatus] = useState<string | null>(null);
  const [importStatus, setImportStatus] = useState<string | null>(null);
  const [pendingRestore, setPendingRestore] = useState<PendingRestore | null>(null);

  useEffect(() => {
    void loadTransactions();
    void loadRules();
    void loadBudgets();
    void loadSettings();
  }, [loadTransactions, loadRules, loadBudgets, loadSettings]);

  /** 导出备份：脱敏版会把交易对方/商品说明/单号里的卡号手机号打码 */
  const handleExport = async (desensitize: boolean) => {
    try {
      setExportStatus('正在导出…');
      // 先把防抖窗口里的改动刷进存储，避免导出的是旧快照
      await flushAllPersists();
      const backup = await buildBackup(storage);

      if (desensitize) {
        const list = backup[STORAGE_KEYS.TRANSACTIONS];
        if (Array.isArray(list)) {
          backup[STORAGE_KEYS.TRANSACTIONS] = maskTransactions(list as Transaction[]);
        }
      }

      downloadJsonFile(backupFilename(desensitize ? '记账备份_已脱敏' : '记账备份_完整'), backup);
      setExportStatus(
        desensitize ? '已导出（银行卡号、手机号、单号已打码）' : '已导出完整备份（含原始文本）',
      );
      setTimeout(() => setExportStatus(null), 5000);
    } catch (e) {
      setExportStatus(`导出失败：${e instanceof Error ? e.message : '未知错误'}`);
    }
  };

  /** 选中备份文件：先校验，不直接写盘 */
  const handlePickBackup = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;

    try {
      setImportStatus(null);
      const raw: unknown = JSON.parse(await file.text());
      const validated = validateBackup(raw);
      if (!validated.ok) {
        setPendingRestore(null);
        setImportStatus(`备份文件不可用：${validated.error}`);
        return;
      }
      setPendingRestore({ fileName: file.name, backup: raw, keys: validated.keys });
    } catch {
      setPendingRestore(null);
      setImportStatus('备份文件不可用：不是合法的 JSON 文件');
    }
  };

  /** 确认恢复：先给当前数据留一份快照，写入失败会自动回滚 */
  const handleConfirmRestore = async () => {
    if (!pendingRestore) return;
    try {
      setImportStatus('正在恢复…');
      await snapshotCurrent(storage);
      const result = await restoreBackup(pendingRestore.backup, storage);

      if (result.ok) {
        setImportStatus(`恢复成功，已还原 ${result.restored} 项数据，页面即将刷新…`);
        setTimeout(() => window.location.reload(), 2000);
      } else {
        setImportStatus(`恢复失败：${result.error}（本机数据已保留原样）`);
      }
    } catch (e) {
      setImportStatus(`恢复失败：${e instanceof Error ? e.message : '未知错误'}`);
    } finally {
      setPendingRestore(null);
    }
  };

  const handleClearAll = async () => {
    try {
      // 原生侧还存着短信/通知原文与待处理队列，不清掉的话下次启动会被重新灌回交易库
      if (Capacitor.isNativePlatform()) {
        try {
          await AutoLedger.clearAllCaptures();
        } catch {
          // 监听服务未连接时清不了，不影响 Web 侧数据清理
        }
      }
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
      <PageHeader
        title="数据管理"
        description="查看数据规模、导出备份，或按月份清理交易记录。"
        backTo="/settings"
      />

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

      {/* 隐私：脱敏开关 */}
      <section className={CARD}>
        <h2 className={SECTION_TITLE}>
          <ShieldCheck size={16} className="text-income" aria-hidden="true" />
          隐私
        </h2>
        <label className="flex cursor-pointer items-start gap-3">
          <input
            type="checkbox"
            checked={settings.importDesensitize}
            onChange={(e) => setImportDesensitize(e.target.checked)}
            className="mt-0.5 h-4 w-4 shrink-0 accent-[var(--color-brand)]"
          />
          <span className="min-w-0">
            <span className="block text-sm font-medium text-ink">导入账单时脱敏</span>
            <span className="mt-0.5 block text-xs text-ink-muted">
              把银行卡号、手机号、交易单号打码后再存进本机。关掉后保留原始内容，方便按单号对账。
            </span>
          </span>
        </label>
      </section>

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
            onClick={() => void handleExport(true)}
            className="flex items-center gap-1.5 rounded-lg bg-brand px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-brand/90"
          >
            <Download size={15} aria-hidden="true" />
            导出备份（已脱敏）
          </button>

          <button
            type="button"
            onClick={() => void handleExport(false)}
            className="flex items-center gap-1.5 rounded-lg border border-line px-4 py-2 text-sm font-medium text-ink transition-colors hover:bg-canvas"
          >
            <Download size={15} aria-hidden="true" />
            导出完整备份
          </button>

          <label className="flex cursor-pointer items-center gap-1.5 rounded-lg border border-line px-4 py-2 text-sm font-medium text-ink transition-colors hover:bg-canvas">
            <Upload size={15} aria-hidden="true" />
            恢复备份
            <input type="file" accept=".json" onChange={handlePickBackup} className="hidden" />
          </label>
        </div>
        <p className="mt-3 text-xs text-ink-subtle">
          完整备份含短信/通知原文，请自行妥善保管；恢复前会自动把当前数据存成一份快照。
        </p>

        {/* 恢复确认：先说清楚会覆盖什么 */}
        {pendingRestore && (
          <div className="mt-3 rounded-xl border border-alert-soft bg-alert-soft p-3">
            <p className="text-sm text-alert">
              将用「{pendingRestore.fileName}」覆盖本机的 {pendingRestore.keys.length} 项数据
              （交易、规则、预算、设置）。当前数据会先存一份快照。
            </p>
            <div className="mt-2.5 flex gap-2">
              <button
                type="button"
                onClick={() => void handleConfirmRestore()}
                className="rounded-lg bg-alert px-4 py-2 text-sm font-medium text-white"
              >
                确认恢复
              </button>
              <button
                type="button"
                onClick={() => setPendingRestore(null)}
                className="rounded-lg border border-line bg-surface px-4 py-2 text-sm text-ink"
              >
                取消
              </button>
            </div>
          </div>
        )}

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

      <section className={CARD}>
        <h2 className="mb-3 flex items-center gap-1.5 text-sm font-semibold text-expense">
          <TriangleAlert size={16} aria-hidden="true" />
          清理数据
        </h2>

        <div className="rounded-xl bg-canvas p-3">
          <p className="text-sm font-medium text-ink">按月份清理</p>
          <p className="mt-1 text-xs text-ink-muted">选择要删除的月份，只清掉那几个月的数据</p>
          <button
            type="button"
            onClick={() => navigate('/cleanup')}
            className="mt-3 flex items-center gap-1.5 rounded-lg bg-surface px-4 py-2 text-sm font-medium text-ink transition-colors hover:bg-brand-soft hover:text-brand"
          >
            <CalendarMinus size={15} aria-hidden="true" />
            选择月份清理
          </button>
        </div>

        <div className="mt-3 rounded-xl border border-expense-soft p-3">
          <p className="text-sm font-medium text-expense">清除所有数据</p>
          <p className="mt-1 text-xs text-ink-muted">
            清掉本机全部数据：交易记录、封面图、分类规则与反馈、预算，以及自动记账的读取规则与
            捕获队列（含尚未处理的通知/短信原文）。此操作不可撤销，建议先导出备份。
          </p>

          {!showClearConfirm ? (
            <div className="mt-3 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => setShowClearConfirm(true)}
                className="rounded-lg border border-expense-soft px-4 py-2 text-sm text-expense transition-colors hover:bg-expense-soft"
              >
                清除所有数据
              </button>
              <button
                type="button"
                onClick={() => void handleExport(true)}
                className="rounded-lg border border-line px-4 py-2 text-sm text-ink transition-colors hover:bg-canvas"
              >
                先导出一份备份
              </button>
            </div>
          ) : (
            <div className="mt-3 rounded-lg bg-expense-soft p-3">
              <p className="mb-2 text-sm font-medium text-expense">
                确定要清除所有数据吗？此操作不可撤销。
              </p>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => void handleClearAll()}
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
        </div>
      </section>
    </div>
  );
}
