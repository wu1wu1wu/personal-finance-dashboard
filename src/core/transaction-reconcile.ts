// ============================================================
// 账单回填引擎 - 用导入的账单补全自动捕获的占位记录
//
// 背景：微信支付通知只有「已支付 ¥23.00」，没有商户名，所以自动捕获的记录
// 只能记下金额、时间和收支方向。账单导出（微信账单 CSV）里带着真实商户、
// 商品和交易单号，导入时把它们补回到对应的占位记录上。
// ============================================================

import type { ClassificationRule, Transaction } from '@/types';
import { classifyTransaction } from '@/core/classifier';

/** 回填匹配的时间窗口：24 小时（与账单导出频率无关） */
export const MATCH_WINDOW_MS = 24 * 60 * 60 * 1000;

export interface ReconcileStats {
  /** 被账单补全的占位记录数 */
  enrichedCount: number;
  /** 账单里有、但没有对应占位的记录数（按新记录加入） */
  addedCount: number;
}

export interface ReconcileResult {
  /** 处理后的完整交易列表 */
  transactions: Transaction[];
  stats: ReconcileStats;
  /** 被补全的记录 id（诊断用） */
  enrichedIds: string[];
}

/** 金额换算成分，避免浮点误差让 23.00 与 23.000001 判不相等 */
function toCents(amount: number): number {
  return Math.round(Math.abs(amount) * 100);
}

/** 解析 "yyyy-MM-dd HH:mm:ss"（本地时间），失败返回 null */
function parseTime(value: string): number | null {
  const m = value?.match(/^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2}):(\d{2})/);
  if (!m) return null;
  const timestamp = new Date(
    Number(m[1]),
    Number(m[2]) - 1,
    Number(m[3]),
    Number(m[4]),
    Number(m[5]),
    Number(m[6]),
  ).getTime();
  return Number.isNaN(timestamp) ? null : timestamp;
}

/**
 * 是否是「可被回填的占位记录」。
 *
 * 只有自动捕获、且用户没有真正动过的记录才允许被覆盖：
 * - `categorySource === 'manual'`：用户手动指定的分类
 * - `userEdited`：用户编辑过金额/时间/商户等内容
 *
 * 注意 `categorySource === 'rule'`（自定义读取规则直接指定的分类）**仍然算占位**：
 * 那是规则给的，不是用户改的，这类记录同样需要账单来补全商户名。
 */
export function isPlaceholder(txn: Transaction): boolean {
  return txn.origin === 'auto' && !txn.userEdited && txn.categorySource !== 'manual';
}

/**
 * 这条账单是不是已经在库里了。
 *
 * 回填会保留占位记录的 id，所以账单自己的 id 记在 `billId` 上；再叠加交易单号，
 * 防止同一笔被重复导入（重复导入会让支出翻倍）。
 */
export function isAlreadyImported(existing: Transaction[], bill: Transaction): boolean {
  return existing.some(
    (txn) =>
      txn.id === bill.id ||
      (!!bill.id && txn.billId === bill.id) ||
      (!!bill.transactionNo && txn.transactionNo === bill.transactionNo),
  );
}

/** 自动捕获的记录是否已经在库里（id 或交易单号命中） */
export function isDuplicateCapture(
  existing: Transaction[],
  id: string,
  transactionNo: string,
): boolean {
  return existing.some(
    (txn) => txn.id === id || (!!transactionNo && txn.transactionNo === transactionNo),
  );
}

interface CandidatePair {
  importedIndex: number;
  placeholderIndex: number;
  timeDiff: number;
}

/**
 * 用账单记录回填占位记录。
 *
 * 匹配规则（必须确定性，否则同金额会串号）：
 * 1. 金额按分完全相等
 * 2. 收支方向一致
 * 3. 时间差不超过 MATCH_WINDOW_MS
 * 4. 时间差最小优先，一对一配对（一条占位只被用一次）
 *
 * 回填时保留占位记录的 id，这样用户已经加过的封面图、标签不会丢。
 */
export function reconcileImportedBills(
  existing: Transaction[],
  imported: Transaction[],
  customRules: ClassificationRule[] = [],
): ReconcileResult {
  const result = [...existing];
  const placeholderIndexes: number[] = [];
  result.forEach((txn, index) => {
    if (isPlaceholder(txn)) placeholderIndexes.push(index);
  });

  // 1. 枚举所有可能的配对
  const pairs: CandidatePair[] = [];
  imported.forEach((bill, importedIndex) => {
    const billTime = parseTime(bill.transactionTime);
    if (billTime === null) return;
    const billCents = toCents(bill.amount);
    const billIsExpense = bill.amount > 0;

    for (const placeholderIndex of placeholderIndexes) {
      const placeholder = result[placeholderIndex];
      if (toCents(placeholder.amount) !== billCents) continue;
      if ((placeholder.amount > 0) !== billIsExpense) continue;
      const placeholderTime = parseTime(placeholder.transactionTime);
      if (placeholderTime === null) continue;
      const timeDiff = Math.abs(placeholderTime - billTime);
      if (timeDiff > MATCH_WINDOW_MS) continue;
      pairs.push({ importedIndex, placeholderIndex, timeDiff });
    }
  });

  // 2. 时间差最小的先配，保证同金额多笔时按时间就近归属
  pairs.sort((a, b) => a.timeDiff - b.timeDiff);

  const usedImported = new Set<number>();
  const usedPlaceholder = new Set<number>();
  const enrichedIds: string[] = [];

  for (const pair of pairs) {
    if (usedImported.has(pair.importedIndex) || usedPlaceholder.has(pair.placeholderIndex)) {
      continue;
    }
    usedImported.add(pair.importedIndex);
    usedPlaceholder.add(pair.placeholderIndex);

    const bill = imported[pair.importedIndex];
    const placeholder = result[pair.placeholderIndex];

    // 账单字段优先，缺失时保留占位记录里已有的值
    const base: Transaction = {
      ...placeholder,
      transactionTime: bill.transactionTime,
      transactionType: bill.transactionType,
      counterparty: bill.counterparty || placeholder.counterparty,
      description: bill.description || placeholder.description,
      paymentMethod: bill.paymentMethod || placeholder.paymentMethod,
      paymentStatus: bill.paymentStatus || placeholder.paymentStatus,
      transactionNo: bill.transactionNo || placeholder.transactionNo,
      // 账单自己的 id 另存一份：占位 id 要保留（封面、标签不丢），
      // 但再次导入同一账单时得靠它认出这笔已经存在
      billId: bill.id || placeholder.billId,
      origin: 'import',
    };

    // 账单带着真实商户名，用它重新跑一次分类
    result[pair.placeholderIndex] = {
      ...base,
      category: classifyTransaction(base, customRules),
      categorySource: 'auto',
    };
    enrichedIds.push(base.id);
  }

  // 3. 没配上占位的账单记录按新记录加入
  const added = imported.filter((_, index) => !usedImported.has(index));

  return {
    transactions: [...result, ...added],
    stats: { enrichedCount: enrichedIds.length, addedCount: added.length },
    enrichedIds,
  };
}
