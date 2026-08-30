// ============================================================
// 账单解析引擎 - 微信支付 CSV/XLSX 文件解析
// ============================================================

import Papa from 'papaparse';
import * as XLSX from 'xlsx';
import type { Transaction } from '@/types';
import { generateTransactionId } from '@/utils/id';
import { normalizeDateTime } from '@/utils/date';
import { parseAmount } from '@/utils/format';

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

/** 微信CSV中文表头 → 英文字段映射 */
const WECHAT_FIELD_MAP: Record<string, string> = {
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
 * 微信支付CSV默认GBK编码，部分新版可能UTF-8
 */
async function decodeFile(file: File): Promise<string> {
  // 先尝试UTF-8解码
  const buffer = await file.arrayBuffer();
  const uint8 = new Uint8Array(buffer);

  // 检测BOM：UTF-8文件以 EF BB BF 开头
  const isUtf8Bom =
    uint8.length >= 3 && uint8[0] === 0xef && uint8[1] === 0xbb && uint8[2] === 0xbf;

  // 检测是否包含GBK特有字节（0x80-0xFE范围的高字节）
  let hasGbkByte = false;
  for (let i = 0; i < Math.min(uint8.length, 2000); i++) {
    if (uint8[i] >= 0x80) {
      hasGbkByte = true;
      break;
    }
  }

  if (!hasGbkByte || isUtf8Bom) {
    // 纯ASCII或UTF-8 BOM，直接用TextDecoder UTF-8
    return new TextDecoder('utf-8').decode(buffer);
  }

  // 尝试GBK解码
  try {
    const text = new TextDecoder('gbk').decode(buffer);
    // 简单验证：如果解码后包含中文字符，说明GBK解码成功
    if (/[\u4e00-\u9fff]/.test(text)) {
      return text;
    }
  } catch {
    // GBK解码失败，回退到UTF-8
  }

  // 最终回退
  return new TextDecoder('utf-8', { fatal: false }).decode(buffer);
}

// ----------------------------------------------------------
// 核心解析逻辑
// ----------------------------------------------------------

/**
 * 解析微信支付账单文件（自动识别 CSV/XLSX 格式）
 */
export async function parseWechatCSV(
  file: File,
  options: ParseOptions = {},
): Promise<ParseResult> {
  const ext = getFileExt(file);

  // 根据文件扩展名选择解析方式
  if (ext === 'xlsx') {
    return parseWechatXLSX(file, options);
  }
  return parseWechatCSVText(file, options);
}

/**
 * 解析微信支付 XLSX 文件
 * 微信导出的 Excel 格式与 CSV 类似，表头相同，但无元信息前缀行
 */
async function parseWechatXLSX(
  file: File,
  options: ParseOptions = {},
): Promise<ParseResult> {
  const errors: string[] = [];
  const existingIds = options.existingIds ?? new Set();
  let duplicateCount = 0;

  try {
    const buffer = await file.arrayBuffer();
    const workbook = XLSX.read(buffer, { type: 'array' });

    // 取第一个工作表
    const sheetName = workbook.SheetNames[0];
    if (!sheetName) {
      return { transactions: [], skippedRows: 0, errors: ['XLSX文件中没有工作表'], duplicateCount: 0 };
    }
    const sheet = workbook.Sheets[sheetName];

    // 转为 JSON 数组（每行一个对象，键为表头）
    // 微信 XLSX 格式：前几行是标题/元信息，真正的表头在数据行中
    // 使用 header: 1 模式获取原始二维数组，手动定位表头
    const rawData: (string | number | undefined)[][] = XLSX.utils.sheet_to_json(sheet, {
      header: 1,
      defval: '',
    });

    if (rawData.length === 0) {
      return { transactions: [], skippedRows: 0, errors: ['XLSX文件中没有数据'], duplicateCount: 0 };
    }

    // 查找包含"交易时间"的行作为表头（跳过标题行和空行）
    let headerRowIndex = -1;
    for (let i = 0; i < Math.min(rawData.length, 30); i++) {
      const row = rawData[i];
      if (Array.isArray(row) && row.some((cell) => String(cell).includes('交易时间'))) {
        headerRowIndex = i;
        break;
      }
    }

    if (headerRowIndex === -1) {
      return {
        transactions: [],
        skippedRows: 0,
        errors: ['XLSX文件中未找到"交易时间"表头，请确认是否为微信支付账单文件'],
        duplicateCount: 0,
      };
    }

    // 提取表头
    const headers = rawData[headerRowIndex].map((h) => String(h).trim());

    // 构建表头索引映射
    const headerIndexMap: Record<string, number> = {};
    headers.forEach((h, i) => {
      if (h && !h.startsWith('__EMPTY')) {
        headerIndexMap[h] = i;
      }
    });

    // 检查关键字段
    const hasTransactionTime = headers.some((h) => h.includes('交易时间'));
    const hasTransactionNo = headers.some((h) => h.includes('交易单号'));

    if (!hasTransactionTime && !hasTransactionNo) {
      return {
        transactions: [],
        skippedRows: 0,
        errors: [
          `XLSX表头不匹配。检测到表头: ${headers.slice(0, 5).join(', ')}... 请确认是否为微信支付账单文件`,
        ],
        duplicateCount: 0,
      };
    }

    // 构建字段名映射：表头 → 英文字段名
    const headerMap: Record<string, string> = {};
    for (const [header, idx] of Object.entries(headerIndexMap)) {
      // 直接匹配
      if (WECHAT_FIELD_MAP[header]) {
        headerMap[String(idx)] = WECHAT_FIELD_MAP[header];
      } else {
        // 模糊匹配
        for (const [cnKey, enKey] of Object.entries(WECHAT_FIELD_MAP)) {
          if (header.includes(cnKey.replace(/[()（）]/g, '')) || cnKey.includes(header)) {
            headerMap[String(idx)] = enKey;
            break;
          }
        }
      }
    }

    // 提取数据行（表头之后的行）
    const dataRows = rawData.slice(headerRowIndex + 1);
    const transactions: Transaction[] = [];
    const now = new Date().toISOString();

    for (const row of dataRows) {
      try {
        if (!Array.isArray(row) || row.length === 0) continue;

        // 使用索引映射提取字段
        const mapped: Record<string, string> = {};
        for (const [idxStr, enKey] of Object.entries(headerMap)) {
          const idx = parseInt(idxStr, 10);
          const val = row[idx];
          if (val !== undefined && val !== '') {
            let strVal = String(val).trim();
            // 转换 Excel 日期序列号为正常日期字符串
            if (enKey === 'transactionTime' && isExcelDateSerial(val)) {
              strVal = excelSerialToDateTime(val as number);
            }
            mapped[enKey] = strVal;
          }
        }

        // 跳过空行或无效行
        if (!mapped.transactionTime || !mapped.transactionNo) continue;

        // 金额解析
        const rawAmount = parseAmount(mapped.amountRaw || '0');
        const isExpense = mapped.incomeExpense === '支出';
        const isIncome = mapped.incomeExpense === '收入';
        const amount = isIncome ? -Math.abs(rawAmount) : Math.abs(rawAmount);

        // 交易类型
        const transactionType: Transaction['transactionType'] = isExpense
          ? '支出'
          : isIncome
            ? '收入'
            : '其他';

        // 保留微信原始交易类型（转账/红包/扫码等），合并到描述中供分类器使用
        const wechatType = mapped.transactionType || '';
        const rawDescription = mapped.description || mapped.remark || '';
        // 当原始微信类型是分类关键信息时，合并到描述中
        const informativeTypes = ['转账', '红包', '扫二维码付款', '群收款'];
        const description = informativeTypes.includes(wechatType) && !rawDescription.includes(wechatType)
          ? (rawDescription ? `${wechatType}: ${rawDescription}` : wechatType)
          : rawDescription;

        // 生成唯一ID
        const id = generateTransactionId(
          mapped.transactionTime,
          amount,
          mapped.transactionNo,
        );

        // 去重检查
        if (existingIds.has(id)) {
          duplicateCount++;
          continue;
        }

        transactions.push({
          id,
          transactionTime: normalizeDateTime(mapped.transactionTime),
          transactionType,
          counterparty: mapped.counterparty || '',
          description,
          amount,
          paymentStatus: mapped.paymentStatus || '',
          transactionNo: mapped.transactionNo,
          paymentMethod: mapped.paymentMethod || '',
          category: '',
          categorySource: 'auto',
          isPeriodic: false,
          tags: [],
          createdAt: now,
          coverImage: '',
        });
      } catch (e) {
        errors.push(`行解析失败: ${e instanceof Error ? e.message : '未知错误'}`);
      }
    }

    return {
      transactions,
      skippedRows: 1, // XLSX 表头行
      errors,
      duplicateCount,
    };
  } catch (e) {
    return {
      transactions: [],
      skippedRows: 0,
      errors: [`XLSX文件读取失败: ${e instanceof Error ? e.message : '未知错误'}`],
      duplicateCount: 0,
    };
  }
}

/**
 * 解析微信支付 CSV 文件（内部实现）
 */
async function parseWechatCSVText(
  file: File,
  options: ParseOptions = {},
): Promise<ParseResult> {
  const errors: string[] = [];
  const existingIds = options.existingIds ?? new Set();
  let duplicateCount = 0;

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
    };
  }

  // Step 2: PapaParse 解析
  const lines = text.split(/\r?\n/);

  // Step 3: 定位数据表头（跳过元信息行）
  let headerIndex = -1;

  for (let i = 0; i < Math.min(lines.length, 30); i++) {
    const line = lines[i].trim();
    // 查找包含"交易时间"的行作为表头
    if (line.includes('交易时间') && line.includes('交易单号')) {
      headerIndex = i;
      break;
    }
  }

  if (headerIndex === -1) {
    // 未找到标准表头，尝试从第16行开始
    if (lines.length > WECHAT_META_ROWS) {
      headerIndex = WECHAT_META_ROWS - 1;
    } else {
      return {
        transactions: [],
        skippedRows: 0,
        errors: ['未找到有效的数据表头，请确认是否为微信支付账单CSV文件'],
        duplicateCount: 0,
      };
    }
  }

  // 提取数据部分（表头+数据行）
  const dataText = lines.slice(headerIndex).join('\n');

  const parseResult = Papa.parse<Record<string, string>>(dataText, {
    header: true,
    skipEmptyLines: true,
    transformHeader: (h: string) => h.trim(),
  });

  if (parseResult.errors.length > 0) {
    parseResult.errors.forEach((e) => {
      if (e.message) errors.push(`CSV解析警告(行${e.row}): ${e.message}`);
    });
  }

  // Step 4-7: 字段映射、金额解析、去重
  const transactions: Transaction[] = [];
  const now = new Date().toISOString();

  for (const row of parseResult.data) {
    try {
      // 字段映射：中文键 → 英文键
      const mapped: Record<string, string> = {};
      for (const [cnKey, enKey] of Object.entries(WECHAT_FIELD_MAP)) {
        if (row[cnKey] !== undefined) {
          mapped[enKey] = (row[cnKey] as string).trim();
        }
      }

      // 跳过空行或无效行
      if (!mapped.transactionTime || !mapped.transactionNo) continue;

      // 金额解析
      const rawAmount = parseAmount(mapped.amountRaw || '0');
      // "支出"为正数，"收入"为负数
      const isExpense = mapped.incomeExpense === '支出';
      const isIncome = mapped.incomeExpense === '收入';
      const amount = isIncome ? -Math.abs(rawAmount) : Math.abs(rawAmount);

      // 交易类型
      const transactionType: Transaction['transactionType'] = isExpense
        ? '支出'
        : isIncome
          ? '收入'
          : '其他';

      // 保留微信原始交易类型（转账/红包/扫码等），合并到描述中供分类器使用
      const wechatType = mapped.transactionType || '';
      const rawDescription = mapped.description || mapped.remark || '';
      const informativeTypes = ['转账', '红包', '扫二维码付款', '群收款'];
      const description = informativeTypes.includes(wechatType) && !rawDescription.includes(wechatType)
        ? (rawDescription ? `${wechatType}: ${rawDescription}` : wechatType)
        : rawDescription;

      // 生成唯一ID（基于交易时间+金额+交易单号）
      const id = generateTransactionId(
        mapped.transactionTime,
        amount,
        mapped.transactionNo,
      );

      // 去重检查
      if (existingIds.has(id)) {
        duplicateCount++;
        continue;
      }

        transactions.push({
          id,
          transactionTime: normalizeDateTime(mapped.transactionTime),
          transactionType,
          counterparty: mapped.counterparty || '',
          description,
          amount,
          paymentStatus: mapped.paymentStatus || '',
          transactionNo: mapped.transactionNo,
          paymentMethod: mapped.paymentMethod || '',
          category: '', // 分类由分类引擎填充
          categorySource: 'auto',
          isPeriodic: false,
          tags: [],
          createdAt: now,
          coverImage: '',
        });
      } catch (e) {
        errors.push(`行解析失败: ${e instanceof Error ? e.message : '未知错误'}`);
      }
    }

    return {
      transactions,
      skippedRows: headerIndex,
      errors,
      duplicateCount,
    };
  }

/**
 * 验证文件是否为微信支付账单文件（CSV 或 XLSX）
 */
export function isWechatCSVFile(file: File): boolean {
  const name = file.name.toLowerCase();
  return name.endsWith('.csv') || name.endsWith('.xlsx');
}

/**
 * 获取文件扩展名
 */
function getFileExt(file: File): string {
  return file.name.toLowerCase().split('.').pop() ?? '';
}