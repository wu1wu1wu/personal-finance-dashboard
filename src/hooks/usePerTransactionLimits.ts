// ============================================================
// usePerTransactionLimits - 查询某分类在某月的单笔消费上限
//
// 精确月份的设置优先于「所有月份通用」的设置。
// 返回查询函数而不是 Map，调用方不用自己处理月份优先级。
// ============================================================

import { useEffect, useMemo } from 'react';
import { useBudgetStore } from '@/stores/budget-store';

export type PerTransactionLimitLookup = (
  category: string,
  month: string,
) => number | undefined;

export function usePerTransactionLimits(): PerTransactionLimitLookup {
  const budgets = useBudgetStore((s) => s.budgets);
  const loadFromStorage = useBudgetStore((s) => s.loadFromStorage);

  // 明细页、详情弹窗也会用到单笔上限，这里自己保证预算已加载，
  // 否则没进过预算页时 budgets 是空的，超限提示不会出现。
  useEffect(() => {
    void loadFromStorage();
  }, [loadFromStorage]);

  return useMemo(() => {
    const generic = new Map<string, number>();
    const byMonth = new Map<string, Map<string, number>>();

    for (const budget of budgets) {
      const limit = budget.maxPerTransaction ?? 0;
      if (limit <= 0) continue;

      if (budget.month === '') {
        generic.set(budget.category, limit);
        continue;
      }
      const forMonth = byMonth.get(budget.month) ?? new Map<string, number>();
      forMonth.set(budget.category, limit);
      byMonth.set(budget.month, forMonth);
    }

    return (category: string, month: string) =>
      byMonth.get(month)?.get(category) ?? generic.get(category);
  }, [budgets]);
}
