// ============================================================
// 设置中心页面 - 账单导入/分类规则/数据管理
// ============================================================

import { useState } from 'react';
import UploadZone from '@/components/transactions/UploadZone';
import CategoryRuleEditor from '@/components/settings/CategoryRuleEditor';
import { useTransactionStore } from '@/stores/transaction-store';
import { useClassificationStore } from '@/stores/classification-store';
import { useBudgetStore } from '@/stores/budget-store';
import { storage } from '@/storage/StorageAdapter';

export default function Settings() {
  const { transactions, clearAll: clearTransactions } = useTransactionStore();
  const { customRules } = useClassificationStore();
  const { budgets, totalBudgets } = useBudgetStore();

  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [exportStatus, setExportStatus] = useState<string | null>(null);
  const [importStatus, setImportStatus] = useState<string | null>(null);

  /** 导出所有数据为 JSON 备份 */
  const handleExport = async () => {
    try {
      setExportStatus('正在导出...');
      const backup: Record<string, unknown> = {};

      // 收集所有 pfd_ 开头的存储数据
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
        keys: keys,
      };

      // 生成并下载 JSON 文件
      const json = JSON.stringify(backup, null, 2);
      const blob = new Blob([json], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `记账看板备份_${new Date().toISOString().substring(0, 10)}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      setExportStatus('导出成功！');
      setTimeout(() => setExportStatus(null), 3000);
    } catch (e) {
      setExportStatus(`导出失败: ${e instanceof Error ? e.message : '未知错误'}`);
    }
  };

  /** 从 JSON 备份恢复数据 */
  const handleImportBackup = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setImportStatus('正在恢复...');
      const text = await file.text();
      const backup = JSON.parse(text) as Record<string, unknown>;

      // 验证备份格式
      if (!backup._meta || typeof backup._meta !== 'object') {
        throw new Error('无效的备份文件格式');
      }

      const meta = backup._meta as { version: string; keys: string[] };
      if (meta.version !== '1.0') {
        throw new Error(`不支持的备份版本: ${meta.version}`);
      }

      // 恢复每条数据
      let restoredCount = 0;
      for (const key of meta.keys) {
        if (backup[key] !== undefined) {
          await storage.set(key, backup[key]);
          restoredCount++;
        }
      }

      // 刷新页面以重新加载所有 Store
      setImportStatus(`恢复成功！已还原 ${restoredCount} 项数据，页面即将刷新...`);
      setTimeout(() => window.location.reload(), 2000);
    } catch (e) {
      setImportStatus(`恢复失败: ${e instanceof Error ? e.message : '未知错误'}`);
      setTimeout(() => setImportStatus(null), 5000);
    }

    // 重置 input
    e.target.value = '';
  };

  /** 清除所有数据 */
  const handleClearAll = async () => {
    try {
      await clearTransactions();
      await storage.clear();
      setShowClearConfirm(false);
      // 刷新页面
      window.location.reload();
    } catch (e) {
      console.error('清除数据失败:', e);
    }
  };

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">设置中心</h1>

      {/* ========== 账单导入 ========== */}
      <section className="bg-white rounded-xl border border-gray-100 p-4">
        <h2 className="text-lg font-semibold text-gray-800 mb-3">📂 账单导入</h2>
        <UploadZone />
        <div className="mt-3 flex gap-4 text-xs text-gray-400">
          <span>支持格式: CSV / XLSX</span>
          <span>编码: GBK / UTF-8</span>
          <span>自动去重</span>
        </div>
      </section>

      {/* ========== 分类规则 ========== */}
      <section className="bg-white rounded-xl border border-gray-100 p-4">
        <h2 className="text-lg font-semibold text-gray-800 mb-3">🏷️ 分类规则</h2>
        <CategoryRuleEditor />
      </section>

      {/* ========== 数据统计 ========== */}
      <section className="bg-white rounded-xl border border-gray-100 p-4">
        <h2 className="text-lg font-semibold text-gray-800 mb-3">📊 数据统计</h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="bg-blue-50 rounded-lg p-3 text-center">
            <div className="text-2xl font-bold text-blue-600">{transactions.length}</div>
            <div className="text-xs text-blue-500 mt-1">交易记录</div>
          </div>
          <div className="bg-purple-50 rounded-lg p-3 text-center">
            <div className="text-2xl font-bold text-purple-600">{customRules.length}</div>
            <div className="text-xs text-purple-500 mt-1">自定义规则</div>
          </div>
          <div className="bg-green-50 rounded-lg p-3 text-center">
            <div className="text-2xl font-bold text-green-600">{budgets.length}</div>
            <div className="text-xs text-green-500 mt-1">分类预算</div>
          </div>
          <div className="bg-orange-50 rounded-lg p-3 text-center">
            <div className="text-2xl font-bold text-orange-600">
              {Object.keys(totalBudgets).length > 0 ? `${Object.keys(totalBudgets).length}个` : '—'}
            </div>
            <div className="text-xs text-orange-500 mt-1">预算月份</div>
          </div>
        </div>
      </section>

      {/* ========== 数据备份与恢复 ========== */}
      <section className="bg-white rounded-xl border border-gray-100 p-4">
        <h2 className="text-lg font-semibold text-gray-800 mb-3">💾 数据备份与恢复</h2>
        <p className="text-sm text-gray-500 mb-4">
          所有数据存储在浏览器本地，不会发送到任何服务器。建议定期备份。
        </p>
        <div className="flex flex-wrap gap-3">
          {/* 导出备份 */}
          <button
            onClick={handleExport}
            disabled={transactions.length === 0}
            className="px-4 py-2 text-sm bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            📥 导出备份
          </button>

          {/* 导入备份 */}
          <label className="px-4 py-2 text-sm bg-green-500 text-white rounded-lg hover:bg-green-600 transition-colors cursor-pointer">
            📤 恢复备份
            <input
              type="file"
              accept=".json"
              onChange={handleImportBackup}
              className="hidden"
            />
          </label>
        </div>

        {/* 操作状态 */}
        {exportStatus && (
          <p className="mt-3 text-sm text-blue-600">{exportStatus}</p>
        )}
        {importStatus && (
          <p className="mt-3 text-sm text-green-600">{importStatus}</p>
        )}
      </section>

      {/* ========== 清除数据 ========== */}
      <section className="bg-white rounded-xl border border-red-100 p-4">
        <h2 className="text-lg font-semibold text-red-700 mb-3">⚠️ 清除数据</h2>
        <p className="text-sm text-gray-500 mb-4">
          清除所有本地存储的交易记录、分类规则、预算设置等数据。此操作不可撤销，请先备份。
        </p>

        {!showClearConfirm ? (
          <button
            onClick={() => setShowClearConfirm(true)}
            className="px-4 py-2 text-sm bg-red-50 text-red-600 border border-red-200 rounded-lg hover:bg-red-100 transition-colors"
          >
            清除所有数据
          </button>
        ) : (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4">
            <p className="text-sm font-medium text-red-700 mb-3">
              确定要清除所有数据吗？此操作不可撤销！
            </p>
            <div className="flex gap-3">
              <button
                onClick={handleClearAll}
                className="px-4 py-2 text-sm bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
              >
                确认清除
              </button>
              <button
                onClick={() => setShowClearConfirm(false)}
                className="px-4 py-2 text-sm bg-white text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
              >
                取消
              </button>
            </div>
          </div>
        )}
      </section>

      {/* ========== 关于 ========== */}
      <section className="bg-white rounded-xl border border-gray-100 p-4">
        <h2 className="text-lg font-semibold text-gray-800 mb-3">ℹ️ 关于</h2>
        <div className="text-sm text-gray-500 space-y-1">
          <p>个人记账看板 v1.0</p>
          <p>数据仅存储在浏览器本地，保护您的隐私</p>
          <p>支持微信支付账单导入（CSV / XLSX 格式）</p>
        </div>
      </section>
    </div>
  );
}