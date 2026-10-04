import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { CalendarMinus, Database, Download, RotateCcw, ShieldCheck, TriangleAlert, Upload } from 'lucide-react';
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
import { useLocale, useT } from '@/i18n';
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
  const { t } = useT();
  const locale = useLocale();
  const {
    transactions,
    trash,
    clearAll: clearTransactions,
    loadFromStorage: loadTransactions,
    restoreTrashEntry,
    clearTrash,
  } = useTransactionStore();
  const { customRules, loadFromStorage: loadRules } = useClassificationStore();
  const { budgets, totalBudgets, loadFromStorage: loadBudgets, restoreFromTrash } =
    useBudgetStore();
  const { settings, loadFromStorage: loadSettings, setImportDesensitize } = useSettingsStore();

  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [exportStatus, setExportStatus] = useState<string | null>(null);
  const [importStatus, setImportStatus] = useState<string | null>(null);
  const [pendingRestore, setPendingRestore] = useState<PendingRestore | null>(null);
  const [trashStatus, setTrashStatus] = useState<string | null>(null);

  useEffect(() => {
    void loadTransactions();
    void loadRules();
    void loadBudgets();
    void loadSettings();
  }, [loadTransactions, loadRules, loadBudgets, loadSettings]);

  /** 从最近删除里恢复一批：交易回库，同批删掉的预算也一并恢复 */
  const handleRestoreTrash = (entryId: string) => {
    const entry = restoreTrashEntry(entryId);
    if (!entry) return;
    restoreFromTrash(entry);
    setTrashStatus(t('settingsData.trash.restored', { count: entry.transactions.length }));
  };

  /** 导出备份：脱敏版会把交易对方/商品说明/单号里的卡号手机号打码 */
  const handleExport = async (desensitize: boolean) => {
    try {
      setExportStatus(t('settingsData.export.inProgress'));
      // 先把防抖窗口里的改动刷进存储，避免导出的是旧快照
      await flushAllPersists();
      const backup = await buildBackup(storage);

      if (desensitize) {
        const list = backup[STORAGE_KEYS.TRANSACTIONS];
        if (Array.isArray(list)) {
          backup[STORAGE_KEYS.TRANSACTIONS] = maskTransactions(list as Transaction[]);
        }
      }

      const prefix = desensitize
        ? t('settingsData.backup.fileNameMasked')
        : t('settingsData.backup.fileNameFull');
      downloadJsonFile(backupFilename(prefix), backup);
      setExportStatus(
        desensitize ? t('settingsData.export.masked') : t('settingsData.export.full'),
      );
      setTimeout(() => setExportStatus(null), 5000);
    } catch (e) {
      setExportStatus(
        t('settingsData.export.failed', {
          message: e instanceof Error ? e.message : t('settingsData.error.unknown'),
        }),
      );
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
        setImportStatus(t('settingsData.restore.invalid', { error: validated.error }));
        return;
      }
      setPendingRestore({ fileName: file.name, backup: raw, keys: validated.keys });
    } catch {
      setPendingRestore(null);
      setImportStatus(t('settingsData.restore.invalidJson'));
    }
  };

  /** 确认恢复：先给当前数据留一份快照，写入失败会自动回滚 */
  const handleConfirmRestore = async () => {
    if (!pendingRestore) return;
    try {
      setImportStatus(t('settingsData.restore.inProgress'));
      await snapshotCurrent(storage);
      const result = await restoreBackup(pendingRestore.backup, storage);

      if (result.ok) {
        setImportStatus(t('settingsData.restore.success', { count: result.restored }));
        setTimeout(() => window.location.reload(), 2000);
      } else {
        setImportStatus(
          t('settingsData.restore.failed', {
            // error 在类型上是可选的，缺失时沿用「未知错误」的措辞
            error: result.error ?? t('settingsData.error.unknown'),
          }),
        );
      }
    } catch (e) {
      setImportStatus(
        t('settingsData.restore.failedUnexpected', {
          message: e instanceof Error ? e.message : t('settingsData.error.unknown'),
        }),
      );
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
    {
      label: t('settingsData.stats.transactions'),
      value: transactions.length,
      tone: 'text-brand bg-brand-soft',
    },
    {
      label: t('settingsData.stats.customRules'),
      value: customRules.length,
      tone: 'text-ink bg-canvas',
    },
    {
      label: t('settingsData.stats.budgets'),
      value: budgets.length,
      tone: 'text-ink bg-canvas',
    },
    {
      label: t('settingsData.stats.budgetMonths'),
      value: Object.keys(totalBudgets).length,
      tone: 'text-ink bg-canvas',
    },
  ];

  return (
    <div className="space-y-4">
      <PageHeader
        title={t('settingsData.title')}
        description={t('settingsData.description')}
        backTo="/settings"
      />

      <section className={CARD}>
        <h2 className={SECTION_TITLE}>
          <Database size={16} className="text-ink-subtle" aria-hidden="true" />
          {t('settingsData.stats.title')}
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
          {t('settingsData.privacy.title')}
        </h2>
        <label className="flex cursor-pointer items-start gap-3">
          <input
            type="checkbox"
            checked={settings.importDesensitize}
            onChange={(e) => setImportDesensitize(e.target.checked)}
            className="mt-0.5 h-4 w-4 shrink-0 accent-[var(--color-brand)]"
          />
          <span className="min-w-0">
            <span className="block text-sm font-medium text-ink">
              {t('settingsData.privacy.maskLabel')}
            </span>
            <span className="mt-0.5 block text-xs text-ink-muted">
              {t('settingsData.privacy.maskHint')}
            </span>
          </span>
        </label>
      </section>

      <section className={CARD}>
        <h2 className={SECTION_TITLE}>
          <Download size={16} className="text-ink-subtle" aria-hidden="true" />
          {t('settingsData.backup.title')}
        </h2>
        <p className="mb-4 text-sm text-ink-muted">{t('settingsData.backup.description')}</p>
        <div className="flex flex-wrap gap-3">
          <button
            type="button"
            onClick={() => void handleExport(true)}
            className="flex items-center gap-1.5 rounded-lg bg-brand px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-brand/90"
          >
            <Download size={15} aria-hidden="true" />
            {t('settingsData.backup.exportMasked')}
          </button>

          <button
            type="button"
            onClick={() => void handleExport(false)}
            className="flex items-center gap-1.5 rounded-lg border border-line px-4 py-2 text-sm font-medium text-ink transition-colors hover:bg-canvas"
          >
            <Download size={15} aria-hidden="true" />
            {t('settingsData.backup.exportFull')}
          </button>

          <label className="flex cursor-pointer items-center gap-1.5 rounded-lg border border-line px-4 py-2 text-sm font-medium text-ink transition-colors hover:bg-canvas">
            <Upload size={15} aria-hidden="true" />
            {t('settingsData.backup.restoreLabel')}
            <input type="file" accept=".json" onChange={handlePickBackup} className="hidden" />
          </label>
        </div>
        <p className="mt-3 text-xs text-ink-subtle">{t('settingsData.backup.note')}</p>

        {/* 恢复确认：先说清楚会覆盖什么 */}
        {pendingRestore && (
          <div className="mt-3 rounded-xl border border-alert-soft bg-alert-soft p-3">
            <p className="text-sm text-alert">
              {t('settingsData.backup.confirmMessage', {
                fileName: pendingRestore.fileName,
                count: pendingRestore.keys.length,
              })}
            </p>
            <div className="mt-2.5 flex gap-2">
              <button
                type="button"
                onClick={() => void handleConfirmRestore()}
                className="rounded-lg bg-alert px-4 py-2 text-sm font-medium text-white"
              >
                {t('settingsData.backup.confirmRestore')}
              </button>
              <button
                type="button"
                onClick={() => setPendingRestore(null)}
                className="rounded-lg border border-line bg-surface px-4 py-2 text-sm text-ink"
              >
                {t('common.cancel')}
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

      {/* 最近删除：删掉的交易在这里留 30 天，可以整批恢复 */}
      <section className={CARD}>
        <h2 className={SECTION_TITLE}>
          <RotateCcw size={16} className="text-ink-subtle" aria-hidden="true" />
          {t('settingsData.trash.title')}
        </h2>
        <p className="mb-3 text-xs text-ink-muted">{t('settingsData.trash.description')}</p>

        {trash.length === 0 ? (
          <p className="rounded-xl bg-canvas px-3 py-4 text-center text-sm text-ink-subtle">
            {t('settingsData.trash.empty')}
          </p>
        ) : (
          <>
            <ul className="space-y-2">
              {trash.map((entry) => (
                <li
                  key={entry.id}
                  className="flex items-center gap-3 rounded-xl border border-line p-3"
                >
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium text-ink">
                      {entry.label}
                    </span>
                    <span className="mt-0.5 block text-xs text-ink-subtle">
                      {[
                        new Date(entry.deletedAt).toLocaleString(locale),
                        t('common.count', { count: entry.transactions.length }),
                        entry.reason === 'months'
                          ? t('settingsData.trash.reasonMonths')
                          : t('settingsData.trash.reasonSingle'),
                      ].join(t('settingsData.separator'))}
                    </span>
                  </span>
                  <button
                    type="button"
                    onClick={() => handleRestoreTrash(entry.id)}
                    className="flex min-h-11 shrink-0 items-center rounded-lg bg-brand px-3 text-sm font-medium text-white transition-colors hover:bg-brand/90"
                  >
                    {t('common.restore')}
                  </button>
                </li>
              ))}
            </ul>

            <button
              type="button"
              onClick={() => {
                clearTrash();
                setTrashStatus(t('settingsData.trash.cleared'));
              }}
              className="mt-3 rounded-lg border border-line px-4 py-2 text-sm text-ink-muted transition-colors hover:bg-canvas hover:text-ink"
            >
              {t('settingsData.trash.clearTrash')}
            </button>
          </>
        )}

        {trashStatus && (
          <p role="status" aria-live="polite" className="mt-3 text-sm text-income">
            {trashStatus}
          </p>
        )}
      </section>

      <section className={CARD}>
        <h2 className="mb-3 flex items-center gap-1.5 text-sm font-semibold text-expense">
          <TriangleAlert size={16} aria-hidden="true" />
          {t('settingsData.cleanup.title')}
        </h2>

        <div className="rounded-xl bg-canvas p-3">
          <p className="text-sm font-medium text-ink">{t('settingsData.cleanup.byMonth.title')}</p>
          <p className="mt-1 text-xs text-ink-muted">
            {t('settingsData.cleanup.byMonth.description')}
          </p>
          <button
            type="button"
            onClick={() => navigate('/cleanup', { state: { from: '/settings/data' } })}
            className="mt-3 flex items-center gap-1.5 rounded-lg bg-surface px-4 py-2 text-sm font-medium text-ink transition-colors hover:bg-brand-soft hover:text-brand"
          >
            <CalendarMinus size={15} aria-hidden="true" />
            {t('settingsData.cleanup.byMonth.action')}
          </button>
        </div>

        <div className="mt-3 rounded-xl border border-expense-soft p-3">
          <p className="text-sm font-medium text-expense">{t('settingsData.cleanup.all.title')}</p>
          <p className="mt-1 text-xs text-ink-muted">
            {t('settingsData.cleanup.all.description')}
          </p>

          {!showClearConfirm ? (
            <div className="mt-3 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => setShowClearConfirm(true)}
                className="rounded-lg border border-expense-soft px-4 py-2 text-sm text-expense transition-colors hover:bg-expense-soft"
              >
                {t('settingsData.cleanup.all.title')}
              </button>
              <button
                type="button"
                onClick={() => void handleExport(true)}
                className="rounded-lg border border-line px-4 py-2 text-sm text-ink transition-colors hover:bg-canvas"
              >
                {t('settingsData.cleanup.all.exportFirst')}
              </button>
            </div>
          ) : (
            <div className="mt-3 rounded-lg bg-expense-soft p-3">
              <p className="mb-2 text-sm font-medium text-expense">
                {t('settingsData.cleanup.all.confirm')}
              </p>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => void handleClearAll()}
                  className="rounded-lg bg-expense px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-expense/90"
                >
                  {t('settingsData.cleanup.all.confirmAction')}
                </button>
                <button
                  type="button"
                  onClick={() => setShowClearConfirm(false)}
                  className="rounded-lg border border-line bg-surface px-4 py-2 text-sm text-ink transition-colors hover:bg-canvas"
                >
                  {t('common.cancel')}
                </button>
              </div>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
