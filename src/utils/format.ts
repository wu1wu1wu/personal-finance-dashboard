// ============================================================
// 格式化工具 - 金额、日期等格式化
// ============================================================

/**
 * 格式化金额为人民币显示
 * @param amount 金额（正数=支出，负数=收入）
 * @param showSign 是否显示正负号
 */
export function formatCurrency(amount: number, showSign = false): string {
  const abs = Math.abs(amount);
  const formatted = abs.toLocaleString('zh-CN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
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
 * 格式化日期为中文显示
 * "2026-07-05 14:30:00" → "7月5日 14:30"
 */
export function formatDateShort(dateStr: string): string {
  const date = new Date(dateStr);
  if (isNaN(date.getTime())) return dateStr;
  const month = date.getMonth() + 1;
  const day = date.getDate();
  const hours = date.getHours().toString().padStart(2, '0');
  const minutes = date.getMinutes().toString().padStart(2, '0');
  return `${month}月${day}日 ${hours}:${minutes}`;
}

/**
 * 格式化月份键
 * "2026-07-05 14:30:00" → "2026-07"
 */
export function formatMonthKey(dateStr: string): string {
  return dateStr.substring(0, 7);
}