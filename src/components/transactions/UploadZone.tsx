// ============================================================
// UploadZone 组件 - CSV 拖拽/点击上传区域
// ============================================================

import { useState, useCallback, useRef } from 'react';
import { parseWechatCSV, isWechatCSVFile } from '@/core/csv-parser';
import { maskTransactions } from '@/core/data-masker';
import { classifyTransactions } from '@/core/classifier';
import { useTransactionStore } from '@/stores/transaction-store';
import { useClassificationStore } from '@/stores/classification-store';

interface UploadResult {
  total: number;
  added: number;
  duplicates: number;
  errors: string[];
}

export default function UploadZone() {
  const [isDragging, setIsDragging] = useState(false);
  const [result, setResult] = useState<UploadResult | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { importing, importMessage, setImporting, addTransactions, getExistingIds, loadFromStorage } =
    useTransactionStore();
  const { loadFromStorage: loadRules, getAllRules } = useClassificationStore();

  /** 处理文件上传 */
  const handleFiles = useCallback(
    async (files: FileList | null) => {
      if (!files || files.length === 0) return;

      const file = files[0];

      // 验证文件类型
      if (!isWechatCSVFile(file)) {
        setResult({
          total: 0,
          added: 0,
          duplicates: 0,
          errors: ['请上传微信支付账单文件（.csv 或 .xlsx 格式）'],
        });
        return;
      }

      setImporting(true, '正在解析账单...');

      try {
        // 确保已加载已有数据
        await loadFromStorage();

        // 解析CSV
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

        // 脱敏处理
        const masked = maskTransactions(parseResult.transactions);

        // 自动分类（加载规则 → 批量分类）
        await loadRules();
        const allRules = getAllRules();
        const classified = classifyTransactions(masked, allRules);

        // 写入Store（自动去重）
        const addedCount = addTransactions(classified.classified);

        setResult({
          total: parseResult.transactions.length,
          added: addedCount,
          duplicates: parseResult.duplicateCount,
          errors: parseResult.errors,
        });

        // 附加分类统计到结果
        if (classified.stats.classified > 0) {
          setImporting(
            false,
            `成功导入 ${addedCount} 条记录，自动分类 ${classified.stats.classified} 条`,
          );
        } else {
          setImporting(
            false,
            addedCount > 0
              ? `成功导入 ${addedCount} 条记录`
              : '没有新记录需要导入（全部重复）',
          );
        }
      } catch (e) {
        setResult({
          total: 0,
          added: 0,
          duplicates: 0,
          errors: [`导入失败: ${e instanceof Error ? e.message : '未知错误'}`],
        });
        setImporting(false);
      }
    },
    [addTransactions, getExistingIds, loadFromStorage, setImporting, loadRules, getAllRules],
  );

  /** 拖拽事件处理 */
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
      handleFiles(e.dataTransfer.files);
    },
    [handleFiles],
  );

  const handleClick = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  const handleFileChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      handleFiles(e.target.files);
      // 重置input以允许重复上传同一文件
      e.target.value = '';
    },
    [handleFiles],
  );

  return (
    <div className="w-full">
      {/* 上传区域 */}
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={handleClick}
        className={`
          relative cursor-pointer rounded-xl border-2 border-dashed p-8
          text-center transition-all duration-200
          ${isDragging
            ? 'border-blue-500 bg-blue-50 scale-[1.02]'
            : 'border-gray-300 bg-gray-50 hover:border-blue-400 hover:bg-blue-50/50'
          }
          ${importing ? 'pointer-events-none opacity-60' : ''}
        `}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept=".csv,.xlsx"
          onChange={handleFileChange}
          className="hidden"
        />

        <div className="flex flex-col items-center gap-3">
          {/* 图标 */}
          <div className={`text-4xl transition-transform ${isDragging ? 'scale-110' : ''}`}>
            {importing ? '⏳' : '📂'}
          </div>

          {/* 文字 */}
          <div>
            <p className="text-base font-medium text-gray-700">
              {importing ? importMessage : '拖拽微信支付账单文件到这里'}
            </p>
            <p className="mt-1 text-sm text-gray-400">
              或点击选择文件 · 支持 CSV/XLSX 格式 · GBK/UTF-8 编码 · 自动去重
            </p>
          </div>
        </div>
      </div>

      {/* 导入结果 */}
      {result && (
        <div className="mt-4 rounded-lg border border-gray-200 bg-white p-4">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-lg">
              {result.added > 0 ? '✅' : result.duplicates > 0 ? 'ℹ️' : '❌'}
            </span>
            <span className="font-medium text-gray-800">
              {result.added > 0
                ? `成功导入 ${result.added} 条新记录`
                : result.duplicates > 0
                  ? `${result.duplicates} 条记录已存在，跳过重复`
                  : '导入失败'}
            </span>
          </div>

          {/* 统计信息 */}
          {result.total > 0 && (
            <div className="flex gap-4 text-sm text-gray-500">
              <span>解析: {result.total} 条</span>
              <span>新增: {result.added} 条</span>
              {result.duplicates > 0 && <span>重复: {result.duplicates} 条</span>}
            </div>
          )}

          {/* 错误信息 */}
          {result.errors.length > 0 && (
            <div className="mt-2 text-sm text-red-600">
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