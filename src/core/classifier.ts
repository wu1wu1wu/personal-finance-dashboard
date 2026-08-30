// ============================================================
// 分类引擎 - 关键词规则匹配 + 用户反馈学习
// ============================================================

import type { Transaction, ClassificationRule } from '@/types';
import { BUILTIN_RULES } from '@/constants/rules';
import { CATEGORIES } from '@/types';

/** 默认分类（未匹配时） */
const DEFAULT_CATEGORY = '待确认';

// 内置规则按 priority 降序预排序（只排一次，避免每次分类重复排序）
// 「其他」兜底规则 priority 为 5（低于其余 10），排最后，保证具体分类优先命中
const SORTED_BUILTIN_RULES = [...BUILTIN_RULES].sort((a, b) => b.priority - a.priority);

/**
 * 分类单条交易记录
 *
 * 匹配优先级：
 * 1. 自定义规则（priority >= 100）→ 按 priority 降序匹配
 * 2. 内置规则 → 按 priority 降序匹配（「其他」priority=5 兜底最后匹配）
 * 3. 未匹配 → "待确认"
 *
 * 匹配逻辑：关键词与 counterparty 或 description 做包含匹配
 * 注：hitCount 为预留的权重学习字段，当前不参与排序
 */
export function classifyTransaction(
  txn: Transaction,
  customRules: ClassificationRule[] = [],
): string {
  const text = `${txn.transactionType} ${txn.counterparty} ${txn.description}`.toLowerCase();

  // 1. 自定义规则优先匹配（priority 降序）
  const sortedCustom = [...customRules].sort((a, b) => b.priority - a.priority);
  for (const rule of sortedCustom) {
    if (matchRule(text, rule)) {
      return rule.category;
    }
  }

  // 2. 内置规则按 priority 降序匹配
  for (const rule of SORTED_BUILTIN_RULES) {
    if (matchRule(text, rule)) {
      return rule.category;
    }
  }

  // 3. 未匹配
  return DEFAULT_CATEGORY;
}

/**
 * 批量分类交易记录
 * @returns 分类后的交易数组（原数组不变，返回新数组）+ 各分类命中统计
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
      stats[txn.category] = (stats[txn.category] || 0) + 1;
      return txn;
    }

    const category = classifyTransaction(txn, customRules);
    stats[category] = (stats[category] || 0) + 1;
    return { ...txn, category, categorySource: 'auto' as const };
  });

  return { classified, stats };
}

/**
 * 关键词匹配逻辑
 * 规则中任一关键词出现在文本中即命中
 */
function matchRule(text: string, rule: ClassificationRule): boolean {
  return rule.keywords.some((kw) => text.includes(kw.toLowerCase()));
}

/**
 * 记录用户分类修正反馈
 * 当同一关键词被修正 > 3次，自动提升为自定义规则
 *
 * @param feedback 反馈记录 { 关键词: 修正分类 }
 * @param existingCustomRules 已有自定义规则
 * @returns 新增的自定义规则列表
 */
export function processFeedback(
  feedback: Record<string, { category: string; count: number }>,
  existingCustomRules: ClassificationRule[],
): ClassificationRule[] {
  const newRules: ClassificationRule[] = [];
  const existingKeywords = new Set(existingCustomRules.flatMap((r) => r.keywords));

  for (const [keyword, { category, count }] of Object.entries(feedback)) {
    // 超过3次反馈且关键词尚未在自定义规则中
    if (count >= 3 && !existingKeywords.has(keyword)) {
      newRules.push({
        id: `rule-custom-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        keywords: [keyword],
        category,
        priority: 100, // 自定义规则优先级
        isCustom: true,
        hitCount: 0,
      });
    }
  }

  return newRules;
}

/**
 * 验证分类名称是否有效
 */
export function isValidCategory(category: string): boolean {
  return CATEGORIES.some((c) => c.name === category);
}

/**
 * 获取所有分类名称列表
 */
export function getCategoryNames(): string[] {
  return CATEGORIES.map((c) => c.name);
}