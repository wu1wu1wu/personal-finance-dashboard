// ============================================================
// 自动记账文本解析器 - 把短信/通知的原始文本解析为交易数据
//
// 解析顺序：
//   1. 清理文本噪音（通知里的类名、超长 token）
//   2. 全局忽略（来源包名 / 关键词）
//   3. 用户自定义规则（按顺序，命中即用）
//   4. 内置兜底规则
// ============================================================

import type { CaptureRule, CaptureSettings } from '@/types';

export type { CaptureRule, CaptureSettings };

/** 解析上下文 */
export interface CaptureContext {
  /** 通知来源包名 */
  packageName?: string;
  rules?: CaptureRule[];
  settings?: CaptureSettings;
}

export interface CapturedParseResult {
  /** 金额（正数=支出，负数=收入） */
  amount: number;
  /** 交易对方 */
  counterparty: string;
  /** 交易类型 */
  transactionType: '支出' | '收入';
  /** 原始描述（已清理噪音） */
  description: string;
  /** 命中的自定义规则 id */
  matchedRuleId?: string;
  /** 自定义规则直接指定的分类 */
  category?: string;
}

const EXPENSE_KEYWORDS = ['支出', '消费', '支付', '付款', '扣款', '缴费', 'pos'];
const INCOME_KEYWORDS = ['收入', '收款', '到账', '入账', '红包', '退款', '转入'];

/**
 * 反向语义：出现这些词说明「钱还没动」，不能记成已完成的交易。
 * 之前「您已产生1个待支付账单共1100元」会被记成一笔 1100 元的支出。
 */
const NEGATIVE_CONTEXTS = [
  '待支付',
  '未支付',
  '尚未支付',
  '未及时支付',
  '待缴',
  '待缴费',
  '应缴',
  '待还款',
  '账单提醒',
  '请尽快',
  '请登录',
  '逾期',
  '支付失败',
  '交易失败',
  '支付未成功',
  '验证码',
  '请勿泄露',
];

/** 金额后面跟这些量词，说明它不是钱 */
const NON_MONEY_UNITS = ['个', '笔', '条', '次', '月', '年', '天', '日', '人', '张', '份'];

/** 通知文本里的技术噪音 */
const NOISE_PATTERNS: RegExp[] = [
  /androidx\.core\.app\.NotificationCompat\$?\w*/g,
  /android\.app\.Notification\$\w*/g,
  /\bBigTextStyle\b/g,
  /\bNotificationCompat\b/g,
];

/** 清理通知原文：去掉系统类名和超长 token，避免污染展示和解析 */
export function cleanCapturedText(text: string): string {
  let out = text;
  for (const re of NOISE_PATTERNS) out = out.replace(re, ' ');
  // 超长的纯字母数字串基本是订单号/签名/链接参数，留着只会干扰金额提取。
  // 注意只匹配「不含中文」的串：中文短信往往整段没有空格，
  // 用 \S{40,} 会把整条正常短信一起删掉。
  out = out.replace(/[A-Za-z0-9+/=_-]{32,}/g, ' ');
  return out.replace(/\s+/g, ' ').trim();
}

/** 判断数字后面跟的是不是量词（是的话说明这不是金额） */
function followedByUnit(text: string, endIndex: number): boolean {
  const next = text[endIndex];
  return next !== undefined && NON_MONEY_UNITS.includes(next);
}

/** 把匹配到的一串数字转成金额，带逗号的先去掉 */
function toAmount(raw: string): number | null {
  const v = Number.parseFloat(raw.replace(/,/g, ''));
  return Number.isNaN(v) || v <= 0 ? null : v;
}

/**
 * 从整段文本中提取金额（返回正数）。
 * 只在货币符号/单位附近取值，不再从「支付」后面的任意数字里抠，
 * 避免把「待支付，1个账单」里的 1 当成金额。
 */
function extractAmount(text: string): number | null {
  const patterns: RegExp[] = [
    /(?:¥|￥)\s*(\d{1,3}(?:,\d{3})+(?:\.\d{1,2})?|\d+(?:\.\d{1,2})?)/,
    /人民币\s*(\d{1,3}(?:,\d{3})+(?:\.\d{1,2})?|\d+(?:\.\d{1,2})?)/,
    /(\d{1,3}(?:,\d{3})+(?:\.\d{1,2})?|\d+(?:\.\d{1,2})?)\s*元/,
  ];

  for (const re of patterns) {
    const m = text.match(re);
    if (!m) continue;
    // 有货币符号或「元」兜底，量词检查只是双保险
    const endIndex = (m.index ?? 0) + m[0].length;
    if (followedByUnit(text, endIndex)) continue;
    const v = toAmount(m[1]);
    if (v !== null) return v;
  }

  // 兜底：金额前有明确的交易动词，且数字紧跟其后（允许少量非数字字符）
  const fallback = /(?:消费|支出|扣款|收款|到账|退款)\s*(?:人民币|¥|￥)?\s*(\d+(?:\.\d{1,2})?)/;
  const fm = text.match(fallback);
  if (fm) {
    const endIndex = (fm.index ?? 0) + fm[0].length;
    if (!followedByUnit(text, endIndex)) {
      const v = toAmount(fm[1]);
      if (v !== null) return v;
    }
  }

  return null;
}

/** 提取交易对方（银行名 / 支付应用 / 消息开头的机构名） */
function extractCounterparty(text: string): string {
  const bankMatch =
    text.match(/【(.{2,12}?(?:银行|信用社|支付))】/) || text.match(/(.{2,12}?(?:银行|信用社))/);
  if (bankMatch) return bankMatch[1];
  if (text.includes('微信')) return '微信支付';
  if (text.includes('支付宝')) return '支付宝';
  // 兜底：取消息开头的机构名，如「【贝壳省心租】」
  const bracket = text.match(/【([^】]{2,16})】/);
  if (bracket) return bracket[1];
  return '';
}

/** 命中反向语义，说明这是一条「提醒」而不是「已完成的交易」 */
function hasNegativeContext(text: string): boolean {
  return NEGATIVE_CONTEXTS.some((k) => text.includes(k));
}

/** 按单条自定义规则尝试解析 */
function tryRule(
  text: string,
  packageName: string,
  rule: CaptureRule,
): CapturedParseResult | null {
  if (rule.packageMatch && !packageName.includes(rule.packageMatch)) return null;
  if (rule.contains.length > 0 && !rule.contains.some((k) => text.includes(k))) return null;
  if (rule.excludes.length > 0 && rule.excludes.some((k) => text.includes(k))) return null;

  let amount: number | null = null;
  if (rule.amountRegex) {
    try {
      const re = new RegExp(rule.amountRegex);
      const m = text.match(re);
      if (m?.[1]) amount = toAmount(m[1]);
    } catch {
      // 正则写错时跳过这条规则，不要让整个解析崩掉
      return null;
    }
  } else {
    amount = extractAmount(text);
  }

  if (amount === null) return null;

  return {
    amount: rule.direction === 'income' ? -amount : amount,
    counterparty: extractCounterparty(text),
    transactionType: rule.direction === 'income' ? '收入' : '支出',
    description: text,
    matchedRuleId: rule.id,
    category: rule.category || undefined,
  };
}

/**
 * 解析捕获到的交易文本，无法识别时返回 null。
 *
 * 传入 rules / settings 后，用户自定义的规则优先于内置规则生效。
 */
export function parseCapturedTransaction(
  text: string,
  context: CaptureContext = {},
): CapturedParseResult | null {
  const cleaned = cleanCapturedText(text ?? '');
  if (cleaned.length === 0) return null;

  const { packageName = '', rules = [], settings } = context;

  // 全局忽略
  if (settings) {
    if (settings.ignorePackages.some((p) => p && packageName.includes(p))) return null;
    if (settings.ignoreKeywords.some((k) => k && cleaned.includes(k))) return null;
  }

  // 自定义规则优先
  for (const rule of rules) {
    if (!rule.enabled) continue;
    const result = tryRule(cleaned, packageName, rule);
    if (result) return result;
  }

  // 内置兜底
  if (hasNegativeContext(cleaned)) return null;

  const isIncome = INCOME_KEYWORDS.some((k) => cleaned.includes(k));
  const isExpense = EXPENSE_KEYWORDS.some((k) => cleaned.toLowerCase().includes(k.toLowerCase()));
  if (!isIncome && !isExpense) return null;

  const amount = extractAmount(cleaned);
  if (amount == null) return null;

  return {
    amount: isIncome ? -amount : amount,
    counterparty: extractCounterparty(cleaned),
    transactionType: isIncome ? '收入' : '支出',
    description: cleaned,
  };
}
