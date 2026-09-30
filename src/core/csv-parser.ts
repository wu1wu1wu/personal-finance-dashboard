// ============================================================
// 账单解析引擎 - 微信支付 / 支付宝 CSV 与 XLSX
//
// 两家导出的列名不同，但落到 Transaction 上完全一样，所以流程是：
//   解码 → 找到表头行并识别格式 → 按该格式的列名映射成统一字段
//   → 金额/方向/描述 → 生成确定性 ID 去重
//
// 识别逻辑与列名映射放在 bill-format.ts（纯判断，单独有测试）。
// ============================================================

import Papa from 'papaparse';
import type { Transaction } from '@/types';
import { generateTransactionId } from '@/utils/id';
import { normalizeDateTime } from '@/utils/date';
import { parseAmount } from '@/utils/format';
import {
  ALIPAY_FIELD_MAP,
  WECHAT_FIELD_MAP,
  cleanField,
  detectBillFormat,
  hasRequiredColumns,
  isUnpaidAlipayStatus,
  mergeDescription,
  normalizeHeaderCell,
  resolveDirection,
} from './bill-format';
import type { BillFormat } from './bill-format';

/**
 * 将 Excel 日期序列号转为标准日期时间字符串
 * Excel 日期序列号 = 1900-01-01 以来的天数（含Excel的1900年闰年bug）
 * 例如: 46203.89304398148 → "2026-06-30 21:26:00"
 */
function excelSerialToDateTime(serial: number): string {
  // Excel 的起始日期: 1899-12-30 (补偿 1900 年闰年 bug)
  const excelEpoch = new Date(1899, 11, 30);
  const msPerDay = 86400000;
  const date = new Date(excelEpoch.getTime() + serial * msPerDay);

  const y = date.getFullYear();
  const m = (date.getMonth() + 1).toString().padStart(2, '0');
  const d = date.getDate().toString().padStart(2, '0');
  const h = date.getHours().toString().padStart(2, '0');
  const min = date.getMinutes().toString().padStart(2, '0');
  const s = date.getSeconds().toString().padStart(2, '0');

  return `${y}-${m}-${d} ${h}:${min}:${s}`;
}

/** 判断值是否为 Excel 日期序列号（典型范围: 40000-60000 = 2009-2064年） */
function isExcelDateSerial(val: unknown): val is number {
  return typeof val === 'number' && val > 30000 && val < 100000;
}

// ----------------------------------------------------------
// 微信支付 CSV 特殊格式常量
// ----------------------------------------------------------

/** 微信CSV元信息行数（前16行为导出时间、账户信息等非数据行） */
const WECHAT_META_ROWS = 16;

/** 解析结果 */
export interface ParseResult {
  /** 成功解析的交易记录 */
  transactions: Transaction[];
  /** 跳过的行数（元信息+表头） */
  skippedRows: number;
  /** 解析错误信息 */
  errors: string[];
  /** 去重跳过的记录数 */
  duplicateCount: number;
  /** 识别出的账单格式 */
  format: BillFormat;
  /** 因「钱没动」被跳过的行数（支付宝交易关闭 / 等待付款） */
  ignoredCount: number;
}

/** 解析选项 */
export interface ParseOptions {
  /** 已有交易ID集合（用于去重） */
  existingIds?: Set<string>;
  /** 是否脱敏 */
  desensitize?: boolean;
}

// ----------------------------------------------------------
// 编码检测与转换
// ----------------------------------------------------------

/**
 * 检测文件编码并转换为UTF-8文本
 * 微信与支付宝导出的 CSV 默认都是 GBK 编码，部分新版可能 UTF-8
 */
async function decodeFile(file: File): Promise<string> {
  const buffer = await file.arrayBuffer();

  // UTF-8 是自校验编码：能严格解码成功就一定是 UTF-8。
  // 之前靠「有高字节就按 GBK 解」判断，会把无 BOM 的 UTF-8 中文账单解成乱码，
  // 表头匹配不到「交易时间」，整个文件就解析不出记录。
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(buffer);
  } catch {
    // 不是合法 UTF-8，按默认的 GBK 处理
  }

  try {
    return new TextDecoder('gbk').decode(buffer);
  } catch {
    // 两种都不行时用宽松 UTF-8，尽量把内容读出来
  }

  return new TextDecoder('utf-8', { fatal: false }).decode(buffer);
}

// ----------------------------------------------------------
// 行 → 交易
// ----------------------------------------------------------

/** 映射后的统一字段（两家的列名都归到这里） */
type MappedRow = Record<string, string>;

/** 按账单格式把一行中文列名转成统一字段名 */
function mapCsvRow(row: Record<string, string>, format: BillFormat): MappedRow {
  const fieldMap = format === 'alipay' ? ALIPAY_FIELD_MAP : WECHAT_FIELD_MAP;
  const mapped: MappedRow = {};

  for (const [cnKey, enKey] of Object.entries(fieldMap)) {
    const value = row[cnKey];
    if (value !== undefined && value !== null) {
      mapped[enKey] = String(value).trim();
    }
  }

  // 支付宝部分导出没有「交易创建时间」，退回用「付款时间」
  if (format === 'alipay' && !mapped.transactionTime) {
    mapped.transactionTime = mapped.paymentTime ?? '';
  }

  return mapped;
}

/** 一行的解析结果：要么产出一条交易，要么说明为什么跳过 */
type RowOutcome =
  | { kind: 'transaction'; transaction: Transaction }
  | { kind: 'skip' }
  | { kind: 'duplicate' }
  | { kind: 'ignored' }
  | { kind: 'error'; message: string };

/**
 * 把统一字段变成一条交易。
 * 两家账单共用这段：金额符号、收支方向、描述合并、去重口径都只有一份实现。
 */
function toTransaction(
  mapped: MappedRow,
  format: BillFormat,
  existingIds: Set<string>,
  now: string,
): RowOutcome {
  try {
    if (!mapped.transactionTime || !mapped.transactionNo) return { kind: 'skip' };

    // 支付宝里「交易关闭 / 等待付款」的钱根本没动，导进来会凭空多出支出
    if (format === 'alipay' && isUnpaidAlipayStatus(mapped.paymentStatus ?? '')) {
      return { kind: 'ignored' };
    }

    const rawAmount = parseAmount(mapped.amountRaw || '0');
    const direction = resolveDirection({
      incomeExpense: mapped.incomeExpense,
      fundStatus: mapped.fundStatus,
    });

    // 支出为正数，收入为负数，不计收支按支出方向记正数但类型为「其他」
    const amount = direction === 'income' ? -Math.abs(rawAmount) : Math.abs(rawAmount);

    const transactionType: Transaction['transactionType'] =
      direction === 'expense' ? '支出' : direction === 'income' ? '收入' : '其他';

    const description = mergeDescription(
      mapped.transactionType ?? '',
      cleanField(mapped.description) || cleanField(mapped.remark),
    );

    const id = generateTransactionId(mapped.transactionTime, amount, mapped.transactionNo);
    if (existingIds.has(id)) return { kind: 'duplicate' };

    return {
      kind: 'transaction',
      transaction: {
        id,
        transactionTime: normalizeDateTime(mapped.transactionTime),
        transactionType,
        counterparty: cleanField(mapped.counterparty),
        description,
        amount,
        paymentStatus: mapped.paymentStatus || '',
        transactionNo: mapped.transactionNo,
        paymentMethod: mapped.paymentMethod || '',
        category: '', // 分类由分类引擎填充
        categorySource: 'auto',
        origin: 'import',
        isPeriodic: false,
        tags: [],
        createdAt: now,
        coverImage: '',
        theme: '',
      },
    };
  } catch (e) {
    return { kind: 'error', message: `行解析失败: ${e instanceof Error ? e.message : '未知错误'}` };
  }
}

/** 收集一批解析结果 */
function collect(
  rows: MappedRow[],
  format: BillFormat,
  existingIds: Set<string>,
  now: string,
): { transactions: Transaction[]; errors: string[]; duplicateCount: number; ignoredCount: number } {
  const transactions: Transaction[] = [];
  const errors: string[] = [];
  let duplicateCount = 0;
  let ignoredCount = 0;

  for (const mapped of rows) {
    const outcome = toTransaction(mapped, format, existingIds, now);
    if (outcome.kind === 'transaction') {
      transactions.push(outcome.transaction);
    } else if (outcome.kind === 'duplicate') {
      duplicateCount++;
    } else if (outcome.kind === 'ignored') {
      ignoredCount++;
    } else if (outcome.kind === 'error') {
      errors.push(outcome.message);
    }
  }

  return { transactions, errors, duplicateCount, ignoredCount };
}

// ----------------------------------------------------------
// 核心解析逻辑
// ----------------------------------------------------------

/**
 * 解析账单文件（自动识别微信 / 支付宝，自动识别 CSV / XLSX）
 */
export async function parseBillFile(
  file: File,
  options: ParseOptions = {},
): Promise<ParseResult> {
  const ext = getFileExt(file);

  // 根据文件扩展名选择解析方式
  if (ext === 'xlsx' || ext === 'xls') {
    return parseBillXLSX(file, options);
  }
  return parseBillCSVText(file, options);
}

/**
 * 解析 XLSX 账单
 * 微信与支付宝导出的 Excel 格式与各自 CSV 表头相同，但无元信息前缀行
 */
async function parseBillXLSX(file: File, options: ParseOptions = {}): Promise<ParseResult> {
  const existingIds = options.existingIds ?? new Set();
  const fail = (message: string): ParseResult => ({
    transactions: [],
    skippedRows: 0,
    errors: [message],
    duplicateCount: 0,
    format: 'unknown',
    ignoredCount: 0,
  });

  try {
    // xlsx 有 861KB，只有真的导入 Excel 账单时才需要。
    // 用动态 import 让它独立成 chunk：CSV 用户和首屏永远不用下载它。
    const XLSX = await import('xlsx');

    const buffer = await file.arrayBuffer();
    const workbook = XLSX.read(buffer, { type: 'array' });

    // 取第一个工作表
    const sheetName = workbook.SheetNames[0];
    if (!sheetName) return fail('XLSX文件中没有工作表');
    const sheet = workbook.Sheets[sheetName];

    // header: 1 拿到原始二维数组，自己找表头行（前面可能有标题/元信息）
    const rawData: (string | number | undefined)[][] = XLSX.utils.sheet_to_json(sheet, {
      header: 1,
      defval: '',
    });

    if (rawData.length === 0) return fail('XLSX文件中没有数据');

    // 找到第一行能认出格式的表头行
    let headerRowIndex = -1;
    let format: BillFormat = 'unknown';
    for (let i = 0; i < Math.min(rawData.length, 30); i++) {
      const row = rawData[i];
      if (!Array.isArray(row)) continue;
      const cells = row.map((cell) => String(cell));
      const detected = detectBillFormat(cells);
      if (detected !== 'unknown') {
        headerRowIndex = i;
        format = detected;
        break;
      }
    }

    if (headerRowIndex === -1) {
      return fail('XLSX文件中未找到账单表头，请确认是否为微信支付或支付宝账单文件');
    }

    const headers = rawData[headerRowIndex].map((h) => String(h).trim());

    if (!hasRequiredColumns(headers, format)) {
      return fail(
        `XLSX表头不匹配。检测到表头: ${headers.slice(0, 5).join(', ')}... 请确认是否为账单文件`,
      );
    }

    // 表头索引映射：列下标 → 统一字段名
    const fieldMap = format === 'alipay' ? ALIPAY_FIELD_MAP : WECHAT_FIELD_MAP;
    const headerMap: Record<number, string> = {};
    headers.forEach((header, index) => {
      if (!header || header.startsWith('__EMPTY')) return;
      const normalized = normalizeHeaderCell(header);
      // 直接匹配
      if (fieldMap[header]) {
        headerMap[index] = fieldMap[header];
        return;
      }
      if (fieldMap[normalized]) {
        headerMap[index] = fieldMap[normalized];
        return;
      }
      // 模糊匹配
      for (const [cnKey, enKey] of Object.entries(fieldMap)) {
        if (normalized.includes(cnKey.replace(/[()（）]/g, '')) || cnKey.includes(normalized)) {
          headerMap[index] = enKey;
          break;
        }
      }
    });

    const dataRows = rawData.slice(headerRowIndex + 1);
    const now = new Date().toISOString();
    const mapped: MappedRow[] = [];

    for (const row of dataRows) {
      if (!Array.isArray(row) || row.length === 0) continue;

      const item: MappedRow = {};
      for (const [idxStr, enKey] of Object.entries(headerMap)) {
        const value = row[Number(idxStr)];
        if (value === undefined || value === '') continue;
        // 转换 Excel 日期序列号为正常日期字符串
        item[enKey] =
          enKey === 'transactionTime' && isExcelDateSerial(value)
            ? excelSerialToDateTime(value)
            : String(value).trim();
      }

      // 支付宝部分导出没有「交易创建时间」，退回用「付款时间」
      if (format === 'alipay' && !item.transactionTime) {
        item.transactionTime = item.paymentTime ?? '';
      }

      mapped.push(item);
    }

    return {
      ...collect(mapped, format, existingIds, now),
      skippedRows: 1, // 表头行
      format,
    };
  } catch (e) {
    return fail(`XLSX文件读取失败: ${e instanceof Error ? e.message : '未知错误'}`);
  }
}

/** 把一行文本切成表头单元格（支付宝会补大量空格对齐） */
function headerCells(line: string): string[] {
  const parsed = Papa.parse<string[]>(line, { header: false, skipEmptyLines: true });
  const first = parsed.data[0] ?? [];
  return first.map((cell) => String(cell));
}

/** 找到的表头行 */
interface HeaderHit {
  index: number;
  format: BillFormat;
  headers: string[];
  /** 关键列是否齐全 */
  complete: boolean;
}

/**
 * 定位表头行并识别账单格式。
 *
 * 只看前 30 行：两家都会在文件开头写一段元信息（导出时间、账号）。
 * 元信息里也可能出现「交易单号」这种词（比如「常见问题：如何查询交易单号」），
 * 所以必须「认得出格式 + 关键列齐全」才算真表头；只认得格式的先记下来，
 * 找不到完整表头时用它报一条明确的错误，而不是静默返回 0 条。
 */
function findHeader(lines: string[]): HeaderHit | null {
  let partial: HeaderHit | null = null;

  for (let i = 0; i < Math.min(lines.length, 30); i++) {
    const line = lines[i];
    if (!line.trim()) continue;

    const cells = headerCells(line);
    const format = detectBillFormat(cells);
    if (format === 'unknown') continue;

    const headers = cells.map(normalizeHeaderCell).filter(Boolean);
    if (hasRequiredColumns(headers, format)) {
      return { index: i, format, headers, complete: true };
    }
    if (!partial) partial = { index: i, format, headers, complete: false };
  }

  return partial;
}

/** 关键列的缺失说明，报错时告诉用户到底缺什么 */
function missingColumnsHint(format: BillFormat): string {
  return format === 'alipay'
    ? '支付宝账单需要「交易号」与「交易创建时间」（或「付款时间」）'
    : '微信账单需要「交易时间」与「交易单号」';
}

/**
 * 解析 CSV 账单文本（内部实现）
 */
async function parseBillCSVText(file: File, options: ParseOptions = {}): Promise<ParseResult> {
  const errors: string[] = [];
  const existingIds = options.existingIds ?? new Set();

  // Step 1: 编码检测与解码
  let text: string;
  try {
    text = await decodeFile(file);
  } catch (e) {
    return {
      transactions: [],
      skippedRows: 0,
      errors: [`文件读取失败: ${e instanceof Error ? e.message : '未知错误'}`],
      duplicateCount: 0,
      format: 'unknown',
      ignoredCount: 0,
    };
  }

  // Step 2: 定位表头并识别格式
  const lines = text.split(/\r?\n/);
  const header = findHeader(lines);

  let headerIndex: number;
  let format: BillFormat;

  if (header?.complete) {
    headerIndex = header.index;
    format = header.format;
  } else if (header) {
    // 认得出是哪家的账单，但关键列不齐：必须报错，不能让用户以为「这个月没花钱」
    return {
      transactions: [],
      skippedRows: 0,
      errors: [
        `表头缺少关键列，无法导入。检测到表头: ${header.headers.slice(0, 5).join(', ')}... ${missingColumnsHint(header.format)}`,
      ],
      duplicateCount: 0,
      format: header.format,
      ignoredCount: 0,
    };
  } else if (lines.length > WECHAT_META_ROWS) {
    // 没认出格式时退回老行为：从第 16 行开始当微信表头试试
    headerIndex = WECHAT_META_ROWS - 1;
    format = 'wechat';
  } else {
    return {
      transactions: [],
      skippedRows: 0,
      errors: ['未找到有效的数据表头，请确认是否为微信支付或支付宝账单文件'],
      duplicateCount: 0,
      format: 'unknown',
      ignoredCount: 0,
    };
  }

  // 提取数据部分（表头+数据行）
  const dataText = lines.slice(headerIndex).join('\n');

  const parseResult = Papa.parse<Record<string, string>>(dataText, {
    header: true,
    skipEmptyLines: true,
    transformHeader: (h: string) => h.trim(),
  });

  // 先映射成统一行，并记住哪些行本来就该跳过（表尾统计、空行），
  // 它们的字段数告警不算错误。
  const rows = parseResult.data
    .filter((row) => row && typeof row === 'object')
    .map((row, index) => ({ index, mapped: mapCsvRow(row, format) }));

  const skippedIndexes = new Set(
    rows
      .filter((entry) => !entry.mapped.transactionTime || !entry.mapped.transactionNo)
      .map((entry) => entry.index),
  );

  if (parseResult.errors.length > 0) {
    // 只报「本该是数据行」的错。
    // 支付宝导出末尾必然带几行统计（共 N 笔记录 / 已收入:0.00元），
    // 它们列数不够是正常的，报出来只会吓用户。
    parseResult.errors.forEach((e) => {
      if (!e.message) return;
      const row = typeof e.row === 'number' ? e.row : -1;
      if (skippedIndexes.has(row)) return;
      errors.push(`CSV解析警告(行${e.row}): ${e.message}`);
    });
  }

  // 字段映射 → 统一行 → 统一成交
  const collected = collect(
    rows.map((entry) => entry.mapped),
    format,
    existingIds,
    new Date().toISOString(),
  );

  return {
    transactions: collected.transactions,
    skippedRows: headerIndex,
    errors: [...collected.errors, ...errors],
    duplicateCount: collected.duplicateCount,
    format,
    ignoredCount: collected.ignoredCount,
  };
}

// ----------------------------------------------------------
// 对外入口
// ----------------------------------------------------------

/**
 * 验证文件是否为可导入的账单文件（CSV 或 XLSX）
 * 微信导出 .csv/.xlsx，支付宝导出 .csv
 */
export function isBillFile(file: File): boolean {
  const name = file.name.toLowerCase();
  return name.endsWith('.csv') || name.endsWith('.xlsx') || name.endsWith('.xls');
}

/**
 * 兼容旧名字：现在会自动识别格式，请用 parseBillFile
 * @deprecated
 */
export const parseWechatCSV = parseBillFile;

/**
 * 获取文件扩展名
 */
function getFileExt(file: File): string {
  return file.name.toLowerCase().split('.').pop() ?? '';
}
