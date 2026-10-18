// src/core/keyword-match.ts
// ============================================================
// 品类关键词匹配
//
// 与旧 classifier 的差别：
//   1. 渠道词不参与匹配（美团/淘宝… 交给渠道层）
//   2. 最长词优先，其次优先级，其次命中数量（旧版是"谁先写谁赢"）
//   3. 支持反例词（excludes）：命中反例则该关键词作废
// ============================================================

import type { ClassificationRule, Transaction } from '@/types';
import { BUILTIN_RULES } from '@/constants/rules';
import { isChannelWord } from './channels';

interface KeywordEntry {
  keyword: string;
  category: string;
  priority: number;
  excludes: string[];
}

function toEntries(rules: ClassificationRule[]): KeywordEntry[] {
  const entries: KeywordEntry[] = [];
  for (const rule of rules) {
    for (const keyword of rule.keywords) {
      if (isChannelWord(keyword)) continue; // 渠道词不是品类词
      entries.push({
        keyword,
        category: rule.category,
        priority: rule.priority,
        excludes: rule.excludes ?? [],
      });
    }
  }
  return entries;
}

const BUILTIN_ENTRIES = toEntries(BUILTIN_RULES);

export interface KeywordHit {
  category: string;
  keyword: string;
}

/**
 * 按品类关键词判定。
 * @returns 命中则返回分类与命中词；否则 null
 */
export function classifyByKeyword(
  txn: Pick<Transaction, 'transactionType' | 'counterparty' | 'description'>,
  options: { customRules?: ClassificationRule[] } = {},
): KeywordHit | null {
  const text = `${txn.transactionType ?? ''} ${txn.counterparty ?? ''} ${txn.description ?? ''}`.toLowerCase();
  if (!text.trim()) return null;

  const custom = options.customRules?.length ? toEntries(options.customRules) : [];
  const candidates = [...custom, ...BUILTIN_ENTRIES].filter((entry) => {
    if (!text.includes(entry.keyword.toLowerCase())) return false;
    return !entry.excludes.some((ex) => text.includes(ex.toLowerCase()));
  });

  if (candidates.length === 0) return null;

  candidates.sort(
    (a, b) =>
      b.keyword.length - a.keyword.length ||
      b.priority - a.priority ||
      a.keyword.localeCompare(b.keyword),
  );
  return { category: candidates[0].category, keyword: candidates[0].keyword };
}
