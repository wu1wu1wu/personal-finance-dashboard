// ============================================================
// 分类引擎 - 对外薄封装
//
// 实际判定已交给 core/classify.ts 的六层编排（商户记忆 / 关键词 / 渠道 / 时段金额）；
// 这里保留旧函数名与签名，避免所有调用点一起改。
// ============================================================

import type { Transaction, ClassificationRule } from '@/types';
import { CATEGORIES } from '@/types';
import { classifyTransaction as classifyWithContext } from './classify';

/** 分类单条交易记录（返回分类名） */
export function classifyTransaction(
  txn: Transaction,
  customRules: ClassificationRule[] = [],
): string {
  return classifyWithContext(txn, { customRules });
}

/**
 * 批量分类交易记录
 * @returns 分类后的交易数组（原数组不变）+ 各分类命中统计
 */
export function classifyTransactions(
  transactions: Transaction[],
  customRules: ClassificationRule[] = [],
): {
  classified: Transaction[];
  stats: Record<string, number>;
} {
  const stats: Record<string, number> = {};
  const classified = transactions.map((txn) => {
    // 已手动分类的不覆盖
    if (txn.categorySource === 'manual' && txn.category) {
      stats[txn.category] = (stats[txn.category] ?? 0) + 1;
      return txn;
    }
    const category = classifyTransaction(txn, customRules);
    stats[category] = (stats[category] ?? 0) + 1;
    return { ...txn, category, categorySource: 'auto' as const };
  });
  return { classified, stats };
}

/**
 * 记录用户分类修正反馈
 * 当同一关键词被修正 >= 3 次，自动提升为自定义规则
 */
export function processFeedback(
  feedback: Record<string, { category: string; count: number }>,
  existingCustomRules: ClassificationRule[],
): ClassificationRule[] {
  const newRules: ClassificationRule[] = [];
  const existingKeywords = new Set(existingCustomRules.flatMap((r) => r.keywords));

  for (const [keyword, { category, count }] of Object.entries(feedback)) {
    if (count >= 3 && !existingKeywords.has(keyword)) {
      newRules.push({
        id: `rule-custom-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        keywords: [keyword],
        category,
        priority: 100,
        isCustom: true,
        hitCount: 0,
      });
    }
  }

  return newRules;
}

/** 验证分类名称是否有效 */
export function isValidCategory(category: string): boolean {
  return CATEGORIES.some((c) => c.name === category);
}

/** 获取所有分类名称列表 */
export function getCategoryNames(): string[] {
  return CATEGORIES.map((c) => c.name);
}
