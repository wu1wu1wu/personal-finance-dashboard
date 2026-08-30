// ============================================================
// ID 生成工具 - 基于内容哈希生成唯一ID
// ============================================================

import { v5 as uuidv5 } from 'uuid';

/** UUID v5 命名空间（个人记账看板专用） */
const NAMESPACE = '6ba7b810-9dad-11d1-80b4-00c04fd430c8';

/**
 * 基于内容生成确定性ID（相同输入始终产生相同ID）
 * 用于交易记录去重：同一笔交易多次导入不会产生重复记录
 */
export function generateId(content: string): string {
  return uuidv5(content, NAMESPACE);
}

/**
 * 生成交易记录的唯一ID
 * 基于"交易时间+金额+交易单号"组合，确保去重
 */
export function generateTransactionId(
  transactionTime: string,
  amount: number,
  transactionNo: string,
): string {
  return generateId(`${transactionTime}|${amount}|${transactionNo}`);
}