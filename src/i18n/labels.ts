// ============================================================
// 数据值 → 文案
//
// 交易上的 category / transactionType 存的是中文常量（历史数据、规则、账单里都是它），
// 不能为了翻译去改数据。这里做「值 → 文案 key」的映射，
// 用 satisfies Record<..., MessageKey> 让类型检查保证：漏一个分类就编译不过。
// ============================================================

import type { CategoryName, PeriodicTransaction, Transaction } from '@/types';
import type { MessageKey } from './messages';
import type { Locale } from './locale';
import { translateIn } from './translate';

/** 10 个分类 值 → key */
export const CATEGORY_MESSAGE_KEYS = {
  餐饮美食: 'category.dining',
  交通出行: 'category.transport',
  购物消费: 'category.shopping',
  休闲娱乐: 'category.entertainment',
  居住生活: 'category.living',
  医疗健康: 'category.health',
  教育学习: 'category.education',
  转账: 'category.transfer',
  其他: 'category.other',
  待确认: 'category.pending',
} satisfies Record<CategoryName, MessageKey>;

/** 收支方向 值 → key */
export const TRANSACTION_TYPE_MESSAGE_KEYS = {
  支出: 'transactionType.expense',
  收入: 'transactionType.income',
  其他: 'transactionType.other',
} satisfies Record<Transaction['transactionType'], MessageKey>;

/** 周期 值 → key */
export const PERIOD_MESSAGE_KEYS = {
  monthly: 'period.monthly',
  quarterly: 'period.quarterly',
  yearly: 'period.yearly',
} satisfies Record<PeriodicTransaction['period'], MessageKey>;

/** 分类名。未知分类（用户自定义？）原样返回，不要显示成 key */
export function categoryLabel(locale: Locale, category: string): string {
  const key = (CATEGORY_MESSAGE_KEYS as Record<string, MessageKey | undefined>)[category];
  return key ? translateIn(locale, key) : category;
}

export function transactionTypeLabel(
  locale: Locale,
  type: Transaction['transactionType'],
): string {
  return translateIn(locale, TRANSACTION_TYPE_MESSAGE_KEYS[type]);
}

export function periodLabel(locale: Locale, period: PeriodicTransaction['period']): string {
  return translateIn(locale, PERIOD_MESSAGE_KEYS[period]);
}
