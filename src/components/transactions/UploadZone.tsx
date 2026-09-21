// ============================================================
// UploadZone - 微信账单 CSV/XLSX 拖拽或点击上传
// ============================================================

import { useState, useCallback, useRef } from 'react';
import { CircleAlert, CircleCheck, CloudUpload, Info, LoaderCircle } from 'lucide-react';
import { parseWechatCSV, isWechatCSVFile } from '@/core/csv-parser';
import { maskTransactions } from '@/core/data-masker';
import { classifyTransactions } from '@/core/classifier';
import { reconcileImportedBills } from '@/core/transaction-reconcile';
import { useTransactionStore } from '@/stores/transaction-store';
import { useClassificationStore } from '@/stores/classification-store';
import { cn } from '@/utils/cn';

interface UploadResult {
  total: number;
  added: number;
  /** 从导入账单里补全的自动记账记录数 */
  enriched?: number;
  duplicates: number;
  errors: string[];
}

export default function UploadZone() {
  const [isDragging, setIsDragging] = useState(false);
  const [result, setResult] = useState<UploadResult | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { importing, importMessage, setImporting, getExistingIds, loadFromStorage } =
    useTransactionStore();
  const { loadFromStorage: loadRules, getAllRules } = useClassificationStore();

  /** 处理上传的文件 */
  const handleFiles = useCallback(
    async (files: FileList | null) => {
      if (!files || files.length === 0) return;

      const file = files[0];

      if (!isWechatCSVFile(file)) {
        setResult({
          total: 0,
          added: 0,
          duplicates: 0,
          errors: ['请上传微信支付账单文件（.csv 或 .xlsx 格式）'],
        });
        return;
      }

      setImporting(true, '正在解析账单…');

      try {
        await loadFromStorage();

        const parseResult = await parseWechatCSV(file, {
          existingIds: getExistingIds(),
        });

        if (parseResult.transactions.length === 0 && parseResult.errors.length > 0) {
          setResult({
            total: 0,
            added: 0,
            duplicates: 0,
            errors: parseResult.errors,
          });
          setImporting(false);
          return;
        }

        const masked = maskTransactions(parseResult.transactions);

        // 自动分类（加载规则 → 批量分类）
        await loadRules();
        const allRules = getAllRules();
        const classified = classifyTransactions(masked, allRules);

        // 写入 Store：先按 id 去重，再把账单补全到已有的自动记账占位记录上，
        // 这样能保留原有的封面和标签，并重新分类。
        const store = useTransactionStore.getState();
        const existingIds = getExistingIds();
        const fresh = classified.classified.filter((t) => !existingIds.has(t.id));
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
          errors: parseResult.errors,
        });

        const parts: string[] = [];
        if (addedCount > 0) parts.push(`新增 ${addedCount} 笔`);
        if (enrichedCount > 0) parts.push(`补全 ${enrichedCount} 笔自动记录`);
        if (classified.stats.classified > 0) parts.push(`自动分类 ${classified.stats.classified} 笔`);

        setImporting(
          false,
          parts.length > 0 ? `导入完成，${parts.join('，')}` : '没有新记录需要导入（全部重复）',
        );
      } catch (e) {
        setResult({
          total: 0,
          added: 0,
          duplicates: 0,
          errors: [`导入失败：${e instanceof Error ? e.message : '未知错误'}`],
        });
        setImporting(false);
      }
    },
    [getExistingIds, loadFromStorage, setImporting, loadRules, getAllRules],
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
        accept=".csv,.xlsx"
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
            {importing ? importMessage : '拖拽微信支付账单到这里'}
          </span>
          <span className="mt-1 block text-xs text-ink-subtle">
            或点击选择文件 · 支持 CSV / XLSX · GBK / UTF-8 编码 · 自动去重
          </span>
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
                ? `成功导入 ${result.added} 笔新记录`
                : result.duplicates > 0
                  ? `${result.duplicates} 笔记录已存在，已跳过重复`
                  : '导入未产生新记录'}
            </span>
          </div>

          {result.total > 0 && (
            <div className="tnum mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-ink-muted">
              <span>解析: {result.total} 笔</span>
              <span>新增: {result.added} 笔</span>
              {(result.enriched ?? 0) > 0 && <span>补全: {result.enriched} 笔</span>}
              {result.duplicates > 0 && <span>重复: {result.duplicates} 笔</span>}
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
