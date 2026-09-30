// ============================================================
// 账单格式识别 - 微信支付 / 支付宝
//
// 两家的导出 CSV 结构不同（列名、表头位置、金额与收支方向的写法），
// 但落到 Transaction 上是一样的。这里只放「认哪种格式」「列名映射」
// 「这行要不要」这类纯判断，真正的解析循环在 csv-parser.ts。
//
// 注意：微信的「交易单号」里不含「交易号」，支付宝的「交易创建时间」里
// 也不含「交易时间」，所以两套标记不会互相误判。
// ============================================================

/** 支持的账单格式 */
export type BillFormat = 'wechat' | 'alipay' | 'unknown';

/** 微信支付账单 中文表头 → 英文字段 */
export const WECHAT_FIELD_MAP: Record<string, string> = {
  交易时间: 'transactionTime',
  交易类型: 'transactionType',
  交易对方: 'counterparty',
  商品: 'description',
  '收/支': 'incomeExpense',
  '金额(元)': 'amountRaw',
  支付方式: 'paymentMethod',
  当前状态: 'paymentStatus',
  交易单号: 'transactionNo',
  商户单号: 'merchantNo',
  备注: 'remark',
  // 兼容不同版本表头
  商品说明: 'description',
  金额: 'amountRaw',
};

/** 支付宝交易记录 中文表头 → 英文字段 */
export const ALIPAY_FIELD_MAP: Record<string, string> = {
  交易号: 'transactionNo',
  支付宝交易号: 'transactionNo',
  商家订单号: 'merchantNo',
  交易创建时间: 'transactionTime',
  付款时间: 'paymentTime',
  最近修改时间: 'lastModifiedTime',
  交易来源地: 'paymentMethod',
  类型: 'transactionType',
  交易对方: 'counterparty',
  商品名称: 'description',
  商品说明: 'description',
  '金额（元）': 'amountRaw',
  '金额(元)': 'amountRaw',
  金额: 'amountRaw',
  '收/支': 'incomeExpense',
  交易状态: 'paymentStatus',
  '服务费（元）': 'serviceFee',
  '成功退款（元）': 'refundAmount',
  备注: 'remark',
  资金状态: 'fundStatus',
};

/**
 * 对分类有用的原始「交易类型」词。
 * 微信写「零钱提现」「信用卡还款」，支付宝写「转账」「充值」「余额宝-单笔转入」，
 * 都是复合词，所以按包含匹配。命中的原始类型会并入 description，
 * 让分类器能识别出这些资金搬运，而不是当成消费。
 */
export const INFORMATIVE_TYPE_KEYWORDS = [
  '转账',
  '红包',
  '提现',
  '退款',
  '还款',
  '零钱通',
  '余额宝',
  '扫二维码付款',
  '群收款',
  '充值',
];

export function isInformativeType(billType: string): boolean {
  return INFORMATIVE_TYPE_KEYWORDS.some((kw) => billType.includes(kw));
}

/** 表头单元格归一化：去 BOM、去首尾与中间空白（支付宝导出会补很多空格对齐） */
export function normalizeHeaderCell(cell: string): string {
  return (cell ?? '')
    .replace(/^\uFEFF/, '')
    .replace(/\s+/g, '')
    .trim();
}

/** 各家的判定标记：命中越多越像 */
const WECHAT_MARKERS = ['交易时间', '交易单号', '商户单号', '当前状态'];
const ALIPAY_MARKERS = ['交易号', '交易创建时间', '资金状态', '商家订单号', '交易来源地', '交易状态'];

/**
 * 从表头识别账单格式。
 * 拿不准就返回 unknown：宁可报「认不出」，也不要把支付宝账单按微信解析成 0 条。
 */
export function detectBillFormat(headers: readonly string[]): BillFormat {
  const cells = headers.map(normalizeHeaderCell).filter(Boolean);
  if (cells.length === 0) return 'unknown';

  const hit = (marker: string): boolean =>
    cells.some((cell) => cell === marker || cell.includes(marker));

  let wechat = 0;
  let alipay = 0;
  for (const marker of WECHAT_MARKERS) if (hit(marker)) wechat++;
  for (const marker of ALIPAY_MARKERS) if (hit(marker)) alipay++;

  if (wechat === 0 && alipay === 0) return 'unknown';
  return alipay > wechat ? 'alipay' : 'wechat';
}

/** 格式识别所需的关键列，缺了就说明「文件不对」而不是「这个月没花钱」 */
export function hasRequiredColumns(headers: readonly string[], format: BillFormat): boolean {
  const cells = headers.map(normalizeHeaderCell).filter(Boolean);
  const hit = (marker: string): boolean =>
    cells.some((cell) => cell === marker || cell.includes(marker));

  if (format === 'alipay') {
    return hit('交易号') && (hit('交易创建时间') || hit('付款时间'));
  }
  // 微信：交易时间 + 交易单号（少一个都会导致每行被跳过，所以必须报错）
  return hit('交易时间') && hit('交易单号');
}

/**
 * 支付宝里「钱没动」的状态。
 * 交易关闭 / 等待付款这些不是真实支出，导进来会凭空多出账单。
 */
const UNPAID_ALIPAY_STATUSES = ['交易关闭', '等待付款', '等待买家付款', '已关闭'];

export function isUnpaidAlipayStatus(status: string): boolean {
  const value = (status ?? '').trim();
  if (!value) return false;
  return UNPAID_ALIPAY_STATUSES.some((pattern) => value === pattern || value.includes(pattern));
}

/** 收支方向判定用到的原始字段 */
export interface DirectionFields {
  /** 收/支（微信：支出/收入//；支付宝：支出/收入/不计收支） */
  incomeExpense?: string;
  /** 资金状态（支付宝独有：已支出/已收入/……） */
  fundStatus?: string;
}

/**
 * 判定收支方向。
 *
 * 只有明确写「支出」「收入」才算数：微信的「/」、支付宝的「不计收支」
 * （转账、充值、提现这类资金搬运）都算 other，由 isConsumption 排除在支出统计外。
 * 老版支付宝导出没有「收/支」列，这时才退回用「资金状态」推断。
 */
export function resolveDirection(fields: DirectionFields): 'expense' | 'income' | 'other' {
  const raw = (fields.incomeExpense ?? '').replace(/\s+/g, '');

  if (raw === '支出' || raw === '已支出') return 'expense';
  if (raw === '收入' || raw === '已收入') return 'income';

  // 明确写了「不计收支」（或微信的「/」）就是资金搬运，不再看别的列
  if (raw === '不计收支' || raw === '/') return 'other';

  // 只有「收/支」列整个缺失时，才退回用支付宝的「资金状态」推断
  if (!raw) {
    const fund = (fields.fundStatus ?? '').replace(/\s+/g, '');
    if (fund === '已支出') return 'expense';
    if (fund === '已收入') return 'income';
  }

  return 'other';
}

/**
 * 商品说明/商户名里的占位符要当空值：
 * 微信导出成 "/"、"-"，支付宝导出成 "无"、空串。
 */
const PLACEHOLDER_VALUES = new Set(['/', '\\', '-', '--', '—', '无', 'N/A', 'n/a', 'null']);

export function cleanField(value: string | undefined | null): string {
  const trimmed = (value ?? '').trim();
  return PLACEHOLDER_VALUES.has(trimmed) ? '' : trimmed;
}

/** 合并原始交易类型与商品说明（类型含分类关键词时并入，供分类器识别） */
export function mergeDescription(billType: string, rawDescription: string): string {
  const type = cleanField(billType);
  const description = cleanField(rawDescription);
  if (!isInformativeType(type)) return description;
  if (description.includes(type)) return description;
  return description ? `${type}: ${description}` : type;
}
