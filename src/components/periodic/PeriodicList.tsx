// ============================================================
// PeriodicList 组件 - 周期性交易列表
// ============================================================

import type { PeriodicTransaction } from '@/types';
import { formatCurrency } from '@/utils/format';
import { CATEGORIES } from '@/types';

interface PeriodicListProps {
  data: PeriodicTransaction[];
  onTogglePeriodic?: (counterparty: string, amount: number) => void;
}

/** 周期标签映射 */
const PERIOD_LABELS: Record<string, { label: string; icon: string; color: string }> = {
  monthly: { label: '月度', icon: '📅', color: 'bg-blue-100 text-blue-700' },
  quarterly: { label: '季度', icon: '📆', color: 'bg-purple-100 text-purple-700' },
  yearly: { label: '年度', icon: '🗓️', color: 'bg-orange-100 text-orange-700' },
};

export default function PeriodicList({ data, onTogglePeriodic }: PeriodicListProps) {
  if (data.length === 0) {
    return (
      <div className="bg-white rounded-xl border border-gray-100 p-4">
        <h3 className="text-sm font-semibold text-gray-700 mb-3">🔄 周期性交易</h3>
        <div className="text-center py-8 text-gray-400">
          <p className="text-3xl mb-2">🔍</p>
          <p className="text-sm">暂未检测到周期性交易</p>
          <p className="text-xs mt-1">连续3个月以上相同金额的支出将被自动识别</p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl border border-gray-100 p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-gray-700">🔄 周期性交易</h3>
        <span className="text-xs text-gray-400">检测到 {data.length} 项</span>
      </div>

      <div className="space-y-2">
        {data.map((item, index) => {
          const periodInfo = PERIOD_LABELS[item.period] ?? PERIOD_LABELS.monthly;
          const catInfo = CATEGORIES.find((c) => c.name === item.category);
          const confidencePercent = Math.round(item.confidence * 100);

          return (
            <div
              key={`${item.counterparty}-${item.amount}-${index}`}
              className="flex items-center gap-3 p-2.5 rounded-lg hover:bg-gray-50 transition-colors group"
            >
              {/* 分类图标 */}
              <span className="text-lg flex-shrink-0">
                {catInfo?.icon ?? '🏷️'}
              </span>

              {/* 主体信息 */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-gray-800 truncate">
                    {item.counterparty || '未知'}
                  </span>
                  <span
                    className={`px-1.5 py-0.5 text-xs rounded-full ${periodInfo.color}`}
                  >
                    {periodInfo.icon} {periodInfo.label}
                  </span>
                </div>
                <div className="flex items-center gap-2 mt-0.5 text-xs text-gray-400">
                  <span>{item.nextDate ? `下次预计: ${item.nextDate}` : item.lastDate ? `最近: ${item.lastDate}` : ''}</span>
                  <span>·</span>
                  <span>{item.category}</span>
                </div>
              </div>

              {/* 金额 + 置信度 */}
              <div className="flex-shrink-0 text-right">
                <div className="text-sm font-semibold text-gray-800">
                  {formatCurrency(item.amount)}
                </div>
                <div className="flex items-center gap-1 justify-end mt-0.5">
                  <div className="w-12 h-1 bg-gray-200 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full ${
                        confidencePercent >= 80
                          ? 'bg-green-400'
                          : confidencePercent >= 50
                            ? 'bg-yellow-400'
                            : 'bg-orange-400'
                      }`}
                      style={{ width: `${confidencePercent}%` }}
                    />
                  </div>
                  <span className="text-xs text-gray-400">{confidencePercent}%</span>
                </div>
              </div>

              {/* 取消标记按钮 */}
              {onTogglePeriodic && (
                <button
                  onClick={() => onTogglePeriodic(item.counterparty, item.amount)}
                  className="opacity-0 group-hover:opacity-100 text-gray-300 hover:text-red-400 transition-all text-xs flex-shrink-0"
                  title="取消周期性标记"
                >
                  ✕
                </button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}