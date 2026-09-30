import { describe, it, expect } from 'vitest'
import * as XLSX from 'xlsx'
import { parseBillFile } from './csv-parser'
import { classifyTransaction } from './classifier'
import { isConsumption } from './transaction-query'

const HEADER =
  '交易时间,交易类型,交易对方,商品,收/支,金额(元),支付方式,当前状态,交易单号,商户单号,备注'

/** 造一个微信格式的 CSV：前 16 行是元信息，之后才是表头和数据 */
function buildWechatCsv(rows: string[]): File {
  const meta = Array.from({ length: 16 }, (_, i) => `--------------- 元信息 ${i + 1} ----------------`)
  const text = [...meta, HEADER, ...rows].join('\n')
  return new File([new TextEncoder().encode(text)], '微信支付账单.csv', { type: 'text/csv' })
}

/** 造一个 XLSX 账单：表头 + 数据行 */
function buildWechatXlsx(headers: string[], rows: string[][]): File {
  const ws = XLSX.utils.aoa_to_sheet([headers, ...rows])
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'Sheet1')
  const buf = XLSX.write(wb, { type: 'array', bookType: 'xlsx' }) as ArrayBuffer
  return new File([buf], '微信支付账单.xlsx', {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  })
}

describe('parseBillFile（微信）', () => {
  it('识别出是微信账单', async () => {
    const file = buildWechatCsv([
      '2026-09-12 21:15:00,商户消费,丰巢,快件畅存费,支出,¥0.50,零钱,支付成功,NO001,,',
    ])

    const result = await parseBillFile(file)

    expect(result.format).toBe('wechat')
  })
  it('正常解析一笔支出', async () => {
    const file = buildWechatCsv([
      '2026-09-12 21:15:00,商户消费,丰巢,快件畅存费,支出,¥0.50,零钱,支付成功,NO001,,',
    ])

    const result = await parseBillFile(file)

    expect(result.errors).toEqual([])
    expect(result.transactions).toHaveLength(1)
    expect(result.transactions[0].counterparty).toBe('丰巢')
    expect(result.transactions[0].description).toBe('快件畅存费')
    expect(result.transactions[0].amount).toBe(0.5)
    expect(result.transactions[0].transactionType).toBe('支出')
  })

  it('把 "/" 占位符当成空值，不要显示成商户名', async () => {
    const file = buildWechatCsv([
      '2026-09-03 18:18:00,商户消费,/,/,支出,¥100.00,零钱,支付成功,NO002,,/',
    ])

    const result = await parseBillFile(file)

    expect(result.transactions).toHaveLength(1)
    expect(result.transactions[0].counterparty).toBe('')
    expect(result.transactions[0].description).toBe('')
  })

  it('其它占位符（- / 无 / N/A）同样按空值处理', async () => {
    const file = buildWechatCsv([
      '2026-09-01 10:00:00,商户消费,-,无,支出,¥12.00,零钱,支付成功,NO003,,N/A',
    ])

    const result = await parseBillFile(file)

    expect(result.transactions[0].counterparty).toBe('')
    expect(result.transactions[0].description).toBe('')
  })

  it('占位符记录不会丢掉后面的商户名', async () => {
    const file = buildWechatCsv([
      '2026-09-12 21:15:00,商户消费,丰巢,/,支出,¥0.50,零钱,支付成功,NO004,,/',
    ])

    const result = await parseBillFile(file)

    expect(result.transactions[0].counterparty).toBe('丰巢')
    expect(result.transactions[0].description).toBe('')
  })
})

describe('不计收支的记录（收/支 列不是支出也不是收入）', () => {
  it('不能当成支出统计', async () => {
    const file = buildWechatCsv([
      '2026-09-05 09:00:00,零钱提现,工商银行,零钱提现,/,¥200.00,零钱,提现成功,NO201,,',
    ])

    const result = await parseBillFile(file)
    const txn = result.transactions[0]

    expect(txn.transactionType).toBe('其他')
    expect(isConsumption(txn)).toBe(false)
  })
})

describe('复合交易类型（微信实际写的是「零钱提现」「信用卡还款」这类词）', () => {
  it('零钱提现也要把「提现」并入描述，才能归到转账', async () => {
    const file = buildWechatCsv([
      '2026-09-05 09:00:00,零钱提现,工商银行,/,支出,¥200.00,零钱,提现成功,NO202,,',
    ])

    const result = await parseBillFile(file)

    expect(result.transactions[0].description).toContain('提现')
    expect(classifyTransaction(result.transactions[0], [])).toBe('转账')
  })
})

describe('XLSX 表头校验', () => {
  it('只缺一个关键表头时必须报错，不能静默返回 0 条', async () => {
    // 少「交易单号」列：老实现因为用了 && 会放行，然后把每一行都跳过
    const file = buildWechatXlsx(
      ['交易时间', '交易类型', '交易对方', '商品', '收/支', '金额(元)', '支付方式', '当前状态'],
      [['2026-09-12 21:15:00', '商户消费', '丰巢', '快件畅存费', '支出', '¥0.50', '零钱', '支付成功']],
    )

    const result = await parseBillFile(file)

    expect(result.transactions).toHaveLength(0)
    expect(result.errors.length).toBeGreaterThan(0)
  })
})

describe('解析 + 分类（真实账单样本）', () => {
  it('截图里的四笔待确认现在都能自动归类', async () => {
    const file = buildWechatCsv([
      '2026-09-12 21:15:00,商户消费,丰巢,快件畅存费,支出,¥0.50,零钱,支付成功,NO101,,',
      '2026-09-12 20:37:00,商户消费,广州骑安,先乘车后付费,支出,¥1.80,零钱,支付成功,NO102,,',
      '2026-09-07 17:28:00,商户消费,武汉市尚酥坊点心店,尚酥坊点心,支出,¥14.80,零钱,支付成功,NO103,,',
    ])

    const result = await parseBillFile(file)
    const categories = result.transactions.map((t) => classifyTransaction(t, []))

    expect(categories).toEqual(['购物消费', '交通出行', '餐饮美食'])
  })
})

// ============================================================
// 支付宝账单
// ============================================================

/** 支付宝导出的列名（真实文件里前面会补空格对齐） */
const ALIPAY_HEADER = [
  '交易号',
  '商家订单号',
  '交易创建时间',
  '付款时间',
  '最近修改时间',
  '交易来源地',
  '类型',
  '交易对方',
  '商品名称',
  '金额（元）',
  '收/支',
  '交易状态',
  '服务费（元）',
  '成功退款（元）',
  '备注',
  '资金状态',
]

/** 造一个支付宝格式的 CSV：开头是元信息，结尾是统计行 */
function buildAlipayCsv(rows: string[][]): File {
  const meta = [
    '支付宝交易记录明细查询',
    '账号:[test@example.com]',
    '起始日期:[2026-09-01 00:00:00]    终止日期:[2026-09-30 23:59:59]',
    '---------------------------------交易记录明细列表------------------------------------',
  ]
  const body = rows.map((cells) => cells.join(','))
  const footer = [
    '------------------------------------------------------------------------------------',
    '共 2 笔记录',
    '已收入:0.00元',
    '待收入:0.00元',
  ]
  const text = [...meta, ALIPAY_HEADER.join(','), ...body, ...footer].join('\n')
  return new File([new TextEncoder().encode(text)], '支付宝交易记录明细.csv', { type: 'text/csv' })
}

/** 一笔支付宝支出 */
const alipayExpense = [
  '2026091200001',
  'T200P001',
  '2026-09-12 21:15:00',
  '2026-09-12 21:15:03',
  '2026-09-12 21:15:03',
  '支付宝网站',
  '即时到账交易',
  '肯德基',
  '午餐',
  '32.00',
  '支出',
  '交易成功',
  '0.00',
  '0.00',
  '',
  '已支出',
]

describe('parseBillFile（支付宝）', () => {
  it('识别格式并解析出交易，统计行不会被当成交易', async () => {
    const file = buildAlipayCsv([
      alipayExpense,
      ['2026091200002', 'T200P002', '2026-09-13 09:00:00', '2026-09-13 09:00:01', '2026-09-13 09:00:01', '支付宝客户端', '即时到账交易', '滴滴出行', '打车', '18.50', '支出', '交易成功', '0.00', '0.00', '', '已支出'],
    ])

    const result = await parseBillFile(file)

    expect(result.errors).toEqual([])
    expect(result.format).toBe('alipay')
    expect(result.transactions).toHaveLength(2)

    const first = result.transactions[0]
    expect(first.transactionNo).toBe('2026091200001')
    expect(first.counterparty).toBe('肯德基')
    expect(first.description).toBe('午餐')
    expect(first.amount).toBe(32)
    expect(first.transactionType).toBe('支出')
    expect(first.transactionTime).toBe('2026-09-12 21:15:00')
    expect(first.origin).toBe('import')
  })

  it('收入记成负数，方向来自「收/支」列', async () => {
    const file = buildAlipayCsv([
      ['2026091200003', 'T200P003', '2026-09-14 10:00:00', '2026-09-14 10:00:01', '', '支付宝网站', '即时到账交易', '某某公司', '退款', '100.00', '收入', '交易成功', '0.00', '0.00', '', '已收入'],
    ])

    const result = await parseBillFile(file)

    expect(result.transactions[0].amount).toBe(-100)
    expect(result.transactions[0].transactionType).toBe('收入')
  })

  it('「不计收支」的转账不算支出', async () => {
    const file = buildAlipayCsv([
      ['2026091200004', 'T200P004', '2026-09-15 12:00:00', '2026-09-15 12:00:01', '', '支付宝网站', '转账', '朋友', '', '200.00', '不计收支', '交易成功', '0.00', '0.00', '', ''],
    ])

    const result = await parseBillFile(file)
    const txn = result.transactions[0]

    expect(txn.transactionType).toBe('其他')
    expect(isConsumption(txn)).toBe(false)
    // 类型里的「转账」要并进描述，分类器才认得出
    expect(classifyTransaction(txn, [])).toBe('转账')
  })

  it('交易关闭 / 等待付款的不导入，并且要计数', async () => {
    const file = buildAlipayCsv([
      ['2026091200005', 'T200P005', '2026-09-16 12:00:00', '2026-09-16 12:00:01', '', '支付宝网站', '即时到账交易', '某商户', '下单未付', '66.00', '支出', '交易关闭', '0.00', '0.00', '', ''],
      ['2026091200006', 'T200P006', '2026-09-16 13:00:00', '2026-09-16 13:00:01', '', '支付宝网站', '即时到账交易', '某商户', '待付款', '77.00', '支出', '等待付款', '0.00', '0.00', '', ''],
      alipayExpense,
    ])

    const result = await parseBillFile(file)

    expect(result.transactions).toHaveLength(1)
    expect(result.ignoredCount).toBe(2)
  })

  it('没有交易创建时间时退回用付款时间', async () => {
    const file = buildAlipayCsv([
      ['2026091200007', 'T200P007', '', '2026-09-17 08:30:00', '', '支付宝网站', '即时到账交易', '早餐店', '豆浆', '5.00', '支出', '交易成功', '0.00', '0.00', '', '已支出'],
    ])

    const result = await parseBillFile(file)

    expect(result.transactions[0].transactionTime).toBe('2026-09-17 08:30:00')
  })

  it('已导入过的交易再次导入会被去重', async () => {
    const file = buildAlipayCsv([alipayExpense])
    const first = await parseBillFile(file)
    const existingIds = new Set(first.transactions.map((t) => t.id))

    const second = await parseBillFile(file, { existingIds })

    expect(second.transactions).toHaveLength(0)
    expect(second.duplicateCount).toBe(1)
  })

  it('缺「交易号」列时明确报错，不能静默返回 0 条', async () => {
    const brokenHeader = ALIPAY_HEADER.filter((h) => h !== '交易号')
    const text = ['元信息', brokenHeader.join(','), alipayExpense.slice(1).join(',')].join('\n')
    const file = new File([new TextEncoder().encode(text)], '坏账单.csv', { type: 'text/csv' })

    const result = await parseBillFile(file)

    expect(result.transactions).toHaveLength(0)
    expect(result.errors.length).toBeGreaterThan(0)
    expect(result.errors[0]).toContain('表头')
  })

  it('支付宝的 Excel 导出同样能导入', async () => {
    const file = buildWechatXlsx(ALIPAY_HEADER, [alipayExpense])
    const result = await parseBillFile(file)

    expect(result.format).toBe('alipay')
    expect(result.transactions).toHaveLength(1)
    expect(result.transactions[0].counterparty).toBe('肯德基')
  })
})
