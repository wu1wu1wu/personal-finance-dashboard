import { describe, it, expect } from 'vitest'
import * as XLSX from 'xlsx'
import { parseWechatCSV } from './csv-parser'
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

describe('parseWechatCSV', () => {
  it('正常解析一笔支出', async () => {
    const file = buildWechatCsv([
      '2026-09-12 21:15:00,商户消费,丰巢,快件畅存费,支出,¥0.50,零钱,支付成功,NO001,,',
    ])

    const result = await parseWechatCSV(file)

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

    const result = await parseWechatCSV(file)

    expect(result.transactions).toHaveLength(1)
    expect(result.transactions[0].counterparty).toBe('')
    expect(result.transactions[0].description).toBe('')
  })

  it('其它占位符（- / 无 / N/A）同样按空值处理', async () => {
    const file = buildWechatCsv([
      '2026-09-01 10:00:00,商户消费,-,无,支出,¥12.00,零钱,支付成功,NO003,,N/A',
    ])

    const result = await parseWechatCSV(file)

    expect(result.transactions[0].counterparty).toBe('')
    expect(result.transactions[0].description).toBe('')
  })

  it('占位符记录不会丢掉后面的商户名', async () => {
    const file = buildWechatCsv([
      '2026-09-12 21:15:00,商户消费,丰巢,/,支出,¥0.50,零钱,支付成功,NO004,,/',
    ])

    const result = await parseWechatCSV(file)

    expect(result.transactions[0].counterparty).toBe('丰巢')
    expect(result.transactions[0].description).toBe('')
  })
})

describe('不计收支的记录（收/支 列不是支出也不是收入）', () => {
  it('不能当成支出统计', async () => {
    const file = buildWechatCsv([
      '2026-09-05 09:00:00,零钱提现,工商银行,零钱提现,/,¥200.00,零钱,提现成功,NO201,,',
    ])

    const result = await parseWechatCSV(file)
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

    const result = await parseWechatCSV(file)

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

    const result = await parseWechatCSV(file)

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

    const result = await parseWechatCSV(file)
    const categories = result.transactions.map((t) => classifyTransaction(t, []))

    expect(categories).toEqual(['购物消费', '交通出行', '餐饮美食'])
  })
})
