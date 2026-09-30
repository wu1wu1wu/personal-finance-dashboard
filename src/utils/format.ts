// ============================================================
// 格式化工具 - 金额、日期等格式化
// ============================================================

/**
 * 金额格式化器。
 * Intl.NumberFormat 的构造不便宜，而列表里每行都要格式化金额，
 * 所以复用同一个实例，而不是每次调用都 toLocaleString 新建一个。
 */
const amountFormatter = new Intl.NumberFormat('zh-CN', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

/** 整数千分位（用于「1,280」这类紧凑写法） */
const integerFormatter = new Intl.NumberFormat('zh-CN', { maximumFractionDigits: 0 });

/**
 * 格式化金额为人民币显示
 * @param amount 金额（正数=支出，负数=收入）
 * @param showSign 是否显示正负号
 */
export function formatCurrency(amount: number, showSign = false): string {
  const formatted = amountFormatter.format(Math.abs(amount));
  if (showSign) {
    return amount < 0 ? `-${formatted}元` : `+${formatted}元`;
  }
  return `${formatted}元`;
}

/**
 * 格式化金额为简洁显示（省略小数位为0的情况）
 */
export function formatCurrencyShort(amount: number): string {
  const abs = Math.abs(amount);
  if (abs >= 10000) {
    return `${(abs / 10000).toFixed(1)}万元`;
  }
  return formatCurrency(amount);
}

/**
 * 只返回金额数字部分（不带单位），用于大字号展示时把「元」单独排版
 * "6266" → "6,266.00"
 */
export function formatAmount(amount: number): string {
  return amountFormatter.format(Math.abs(amount));
}

/**
 * 金额的紧凑写法，给圆形徽标这类空间很小的位置用
 * 1280 → "1,280"；12800 → "1.3万"
 */
export function formatAmountCompact(amount: number): string {
  const abs = Math.abs(amount);
  if (abs >= 10000) {
    const wan = abs / 10000;
    return `${wan >= 10 ? wan.toFixed(0) : wan.toFixed(1)}万`;
  }
  if (abs >= 1000) return integerFormatter.format(Math.round(abs));
  return abs.toFixed(2);
}

/**
 * 解析微信CSV金额字符串
 * "¥128.50" → 128.50
 * "-¥50.00" → -50.00
 * "¥3.00元" → 3.00 (XLSX中可能带"元"后缀)
 * "日3.00" → 3.00 (¥符号被错误解析的情况)
 */
export function parseAmount(raw: string): number {
  if (!raw || typeof raw !== 'string') return 0;
  // 去除各种货币符号、逗号、空格、"元"后缀
  // 注意：¥ 在某些编码下可能被解析为 "日" 或 "￥"
  const cleaned = raw
    .replace(/[¥￥,\s]/g, '')
    .replace(/日/g, '')
    .replace(/元$/, '')
    .trim();
  const num = parseFloat(cleaned);
  return isNaN(num) ? 0 : num;
}

/**
 * 解析筛选框里的金额输入
 * 空串或非法输入返回 undefined（= 不构成筛选条件），负数取绝对值
 */
export function parseAmountInput(raw: string): number | undefined {
  const trimmed = raw.trim();
  if (!trimmed) return undefined;
  const value = Number(trimmed);
  if (!Number.isFinite(value)) return undefined;
  return Math.abs(value);
}

/**
 * 格式化日期为中文显示
 * "2026-07-05 14:30:00" → "7月5日 14:30"
 *
 * 不用 new Date(dateStr)：iOS Safari 与部分旧 WebKit 解析
 * "yyyy-MM-dd HH:mm:ss"（空格分隔）会得到 Invalid Date，导致明细里时间显示成原文。
 */
export function formatDateShort(dateStr: string): string {
  const match = dateStr?.match(/^(\d{4})-(\d{2})-(\d{2})(?:[ T](\d{2}):(\d{2}))?/);
  if (!match) return dateStr;

  const month = Number(match[2]);
  const day = Number(match[3]);
  const hours = match[4] ?? '00';
  const minutes = match[5] ?? '00';
  return `${month}月${day}日 ${hours}:${minutes}`;
}

/**
 * 格式化月份键
 * "2026-07-05 14:30:00" → "2026-07"
 */
export function formatMonthKey(dateStr: string): string {
  return dateStr.substring(0, 7);
}
