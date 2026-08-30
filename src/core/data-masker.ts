// ============================================================
// 数据脱敏器 - 银行卡号、姓名等敏感字段脱敏
// ============================================================

import type { Transaction } from '@/types';

/**
 * 银行卡号脱敏：仅显示后4位
 * 匹配连续 16 位以上数字（银行卡号），11 位手机号交由 maskPhone 单独处理，避免误伤
 * "6222021234567890" → "************7890"
 */
export function maskBankCard(text: string): string {
  // 银行卡号为 16-19 位；手机号为 11 位，故用 \d{12,} 做下限以区分两者
  return text.replace(/\d{12,}(\d{4})/g, (match, last4) => {
    return '*'.repeat(match.length - 4) + last4;
  });
}

/**
 * 姓名脱敏：保留姓，名用*替代
 * "张三丰" → "张**"
 * "李四" → "李*"
 * "欧阳修" → "欧**"
 */
export function maskName(name: string): string {
  if (!name || name.length <= 1) return name;
  if (name.length === 2) return name[0] + '*';
  return name[0] + '*'.repeat(name.length - 1);
}

/**
 * 手机号脱敏：中间4位用*替代
 * "13812345678" → "138****5678"
 */
export function maskPhone(phone: string): string {
  return phone.replace(/(\d{3})\d{4}(\d{4})/, '$1****$2');
}

/**
 * 对交易对方字段进行脱敏
 * 处理银行卡号、手机号等敏感信息
 */
export function maskCounterparty(counterparty: string): string {
  let result = counterparty;
  // 银行卡号脱敏
  result = maskBankCard(result);
  // 手机号脱敏
  result = maskPhone(result);
  return result;
}

/**
 * 对单条交易记录进行脱敏
 */
export function maskTransaction(txn: Transaction): Transaction {
  return {
    ...txn,
    counterparty: maskCounterparty(txn.counterparty),
    // 交易单号脱敏（保留前后4位）
    transactionNo: txn.transactionNo.length > 8
      ? txn.transactionNo.slice(0, 4) + '****' + txn.transactionNo.slice(-4)
      : txn.transactionNo,
  };
}

/**
 * 批量脱敏交易记录
 */
export function maskTransactions(transactions: Transaction[]): Transaction[] {
  return transactions.map(maskTransaction);
}