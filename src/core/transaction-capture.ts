// ============================================================
// 自动记账文本解析器 - 把短信/通知的原始文本解析为交易数据
// 说明：这是 v1 初版，正则规则需根据真机实际短信/通知格式持续补充
// ============================================================

export interface CapturedParseResult {
  /** 金额（正数=支出，负数=收入） */
  amount: number;
  /** 交易对方 */
  counterparty: string;
  /** 交易类型 */
  transactionType: '支出' | '收入';
  /** 原始描述 */
  description: string;
}

const EXPENSE_KEYWORDS = ['支出', '消费', '支付', '付款', '扣款', '缴费', 'pos'];
const INCOME_KEYWORDS = ['收入', '收款', '到账', '入账', '红包', '退款', '转入'];

/** 从整段文本中提取金额（返回正数） */
function extractAmount(text: string): number | null {
  const patterns = [
    /(?:¥|￥)\s*(\d+(?:\.\d{1,2})?)/,
    /人民币\s*(\d+(?:\.\d{1,2})?)/,
    /(\d+(?:\.\d{1,2})?)\s*元/,
    /(?:消费|支出|收入|支付|付款|收款|到账|扣款|转账)[^\d]{0,8}?(\d+(?:\.\d{1,2})?)/,
  ];
  for (const re of patterns) {
    const m = text.match(re);
    if (m) {
      const v = parseFloat(m[1]);
      if (!Number.isNaN(v) && v > 0) return v;
    }
  }
  return null;
}

/** 提取交易对方（银行名或支付应用名） */
function extractCounterparty(text: string): string {
  const bankMatch =
    text.match(/【(.{2,12}?(?:银行|信用社|支付))】/) || text.match(/(.{2,12}?(?:银行|信用社))/);
  if (bankMatch) return bankMatch[1];
  if (text.includes('微信')) return '微信支付';
  if (text.includes('支付宝')) return '支付宝';
  return '';
}

/** 解析捕获到的交易文本，无法识别时返回 null */
export function parseCapturedTransaction(text: string): CapturedParseResult | null {
  if (!text || text.trim().length === 0) return null;

  const isIncome = INCOME_KEYWORDS.some((k) => text.includes(k));
  const isExpense = EXPENSE_KEYWORDS.some((k) => text.toLowerCase().includes(k.toLowerCase()));

  if (!isIncome && !isExpense) return null;

  const amount = extractAmount(text);
  if (amount == null) return null;

  const counterparty = extractCounterparty(text);

  return {
    amount: isIncome ? -amount : amount,
    counterparty,
    transactionType: isIncome ? '收入' : '支出',
    description: text.trim(),
  };
}
