// ============================================================
// UploadZone - 微信 / 支付宝账单 CSV/XLSX 拖拽或点击上传
// ============================================================

import { useState, useCallback, useRef } from 'react';
import { CircleAlert, CircleCheck, CloudUpload, Info, LoaderCircle } from 'lucide-react';
import { parseBillFile, isBillFile } from '@/core/csv-parser';
import type { BillFormat } from '@/core/bill-format';
import { maskTransactions } from '@/core/data-masker';
import { classifyTransactions } from '@/core/classifier';
import { reconcileImportedBills, isAlreadyImported } from '@/core/transaction-reconcile';
import { useTransactionStore } from '@/stores/transaction-store';
import { useClassificationStore } from '@/stores/classification-store';
import { useSettingsStore } from '@/stores/settings-store';
import { useT } from '@/i18n';
import { cn } from '@/utils/cn';

interface UploadResult {
  total: number;
  added: number;
  /** 从导入账单里补全的自动记账记录数 */
  enriched?: number;
  duplicates: number;
  /** 识别出的账单来源 */
  format?: BillFormat;
  /** 因「钱没动」被跳过的笔数（支付宝交易关闭 / 等待付款） */
  ignored: number;
  errors: string[];
}

export default function UploadZone() {
  const [isDragging, setIsDragging] = useState(false);
  const [result, setResult] = useState<UploadResult | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { t } = useT();

  const { importing, importMessage, setImporting, getExistingIds, loadFromStorage } =
    useTransactionStore();
  const { loadFromStorage: loadRules, getAllRules } = useClassificationStore();

  /** 处理上传的文件 */
  const handleFiles = useCallback(
    async (files: FileList | null) => {
      if (!files || files.length === 0) return;

      const file = files[0];

      if (!isBillFile(file)) {
        setResult({
          total: 0,
          added: 0,
          duplicates: 0,
          ignored: 0,
          errors: [t('billImport.upload.wrongType')],
        });
        return;
      }

      setImporting(true, t('billImport.upload.parsing'));

      try {
        await loadFromStorage();

        const parseResult = await parseBillFile(file, {
          existingIds: getExistingIds(),
        });

        if (parseResult.transactions.length === 0 && parseResult.errors.length > 0) {
          setResult({
            total: 0,
            added: 0,
            duplicates: 0,
            ignored: parseResult.ignoredCount,
            format: parseResult.format,
            errors: parseResult.errors,
          });
          setImporting(false);
          return;
        }

        // 脱敏按设置走（默认开）：关掉后保留账单里的原始卡号/单号，方便对账
        await useSettingsStore.getState().loadFromStorage();
        const desensitize = useSettingsStore.getState().settings.importDesensitize;
        const masked = desensitize
          ? maskTransactions(parseResult.transactions)
          : parseResult.transactions;

        // 自动分类（加载规则 → 批量分类）
        await loadRules();
        const allRules = getAllRules();
        const classified = classifyTransactions(masked, allRules);

        // 写入 Store：先按 id / 账单 id / 交易单号去重，再把账单补全到已有的自动记账占位记录上，
        // 这样能保留原有的封面和标签，并重新分类。
        // 注意不能只看 id：被回填过的记录保留的是占位 id，账单 id 记在 billId 上，
        // 否则同一份账单再导一次会让支出翻倍。
        const store = useTransactionStore.getState();
        const fresh = classified.classified.filter(
          (t) => !isAlreadyImported(store.transactions, t),
        );
        const duplicateByImport = classified.classified.length - fresh.length;
        const reconcile = reconcileImportedBills(store.transactions, fresh, allRules);
        store.applyReconcile(reconcile.transactions);

        const addedCount = reconcile.stats.addedCount;
        const enrichedCount = reconcile.stats.enrichedCount;

        setResult({
          total: parseResult.transactions.length,
          added: addedCount,
          enriched: enrichedCount,
          duplicates: parseResult.duplicateCount + duplicateByImport,
          ignored: parseResult.ignoredCount,
          format: parseResult.format,
          errors: parseResult.errors,
        });

        const parts: string[] = [];
        if (addedCount > 0) parts.push(t('billImport.done.added', { count: addedCount }));
        if (enrichedCount > 0)
          parts.push(t('billImport.done.enriched', { count: enrichedCount }));
        if (classified.stats.classified > 0)
          parts.push(t('billImport.done.classified', { count: classified.stats.classified }));

        setImporting(
          false,
          parts.length > 0
            ? t('billImport.done.summary', { parts: parts.join(t('billImport.done.separator')) })
            : t('billImport.done.nothing'),
        );
      } catch (e) {
        setResult({
          total: 0,
          added: 0,
          duplicates: 0,
          ignored: 0,
          errors: [
            t('billImport.upload.failed', {
              message: e instanceof Error ? e.message : String(e),
            }),
          ],
        });
        setImporting(false);
      }
    },
    [getExistingIds, loadFromStorage, setImporting, loadRules, getAllRules, t],
  );

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragging(false);
      void handleFiles(e.dataTransfer.files);
    },
    [handleFiles],
  );

  const handleFileChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      void handleFiles(e.target.files);
      // 重置 input，允许重复上传同一个文件
      e.target.value = '';
    },
    [handleFiles],
  );

  const hasErrors = result !== null && result.errors.length > 0;
  const addedSomething = (result?.added ?? 0) > 0 || (result?.enriched ?? 0) > 0;

  return (
    <div className="w-full">
      <input
        ref={fileInputRef}
        type="file"
        accept=".csv,.xlsx,.xls"
        onChange={handleFileChange}
        className="hidden"
      />

      <button
        type="button"
        onClick={() => fileInputRef.current?.click()}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        disabled={importing}
        className={cn(
          'flex w-full flex-col items-center gap-3 rounded-xl border-2 border-dashed px-6 py-7 text-center',
          'transition-colors',
          isDragging
            ? 'border-brand bg-brand-soft'
            : 'border-line bg-canvas hover:border-brand/50 hover:bg-brand-soft/50',
          importing && 'cursor-wait opacity-60',
        )}
      >
        {importing ? (
          <LoaderCircle size={28} className="animate-spin text-brand" aria-hidden="true" />
        ) : (
          <CloudUpload size={28} className="text-ink-subtle" aria-hidden="true" />
        )}

        <span className="block">
          <span className="block text-sm font-medium text-ink">
            {importing ? importMessage : t('billImport.upload.prompt')}
          </span>
          <span className="mt-1 block text-xs text-ink-subtle">{t('billImport.upload.hint')}</span>
        </span>
      </button>

      {/* 导入结果 */}
      {result && (
        <div
          role="status"
          aria-live="polite"
          className="mt-3 rounded-xl border border-line bg-surface p-4"
        >
          <div className="flex items-center gap-2">
            {hasErrors && !addedSomething ? (
              <CircleAlert size={17} className="shrink-0 text-expense" aria-hidden="true" />
            ) : addedSomething ? (
              <CircleCheck size={17} className="shrink-0 text-income" aria-hidden="true" />
            ) : (
              <Info size={17} className="shrink-0 text-ink-subtle" aria-hidden="true" />
            )}
            <span className="text-sm font-medium text-ink">
              {result.added > 0
                ? t('billImport.result.added', { count: result.added })
                : result.duplicates > 0
                  ? t('billImport.result.duplicates', { count: result.duplicates })
                  : t('billImport.result.none')}
            </span>
          </div>

          {result.total > 0 && (
            <div className="tnum mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-ink-muted">
              {result.format && result.format !== 'unknown' && (
                <span>
                  {t('billImport.stats.format', {
                    format: t(
                      result.format === 'alipay'
                        ? 'billImport.format.alipay'
                        : 'billImport.format.wechat',
                    ),
                  })}
                </span>
              )}
              <span>{t('billImport.stats.parsed', { count: result.total })}</span>
              <span>{t('billImport.stats.added', { count: result.added })}</span>
              {(result.enriched ?? 0) > 0 && (
                <span>{t('billImport.stats.enriched', { count: result.enriched ?? 0 })}</span>
              )}
              {result.duplicates > 0 && (
                <span>{t('billImport.stats.duplicates', { count: result.duplicates })}</span>
              )}
              {result.ignored > 0 && (
                <span>{t('billImport.stats.ignored', { count: result.ignored })}</span>
              )}
            </div>
          )}

          {result.errors.length > 0 && (
            <div className="mt-2 space-y-0.5 text-xs text-expense">
              {result.errors.map((err, i) => (
                <p key={i}>{err}</p>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
