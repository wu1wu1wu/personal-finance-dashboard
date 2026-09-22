import { describe, it, expect } from 'vitest'
import { parseWechatCSV } from './csv-parser'
import { classifyTransaction } from './classifier'

const HEADER =
  '交易时间,交易类型,交易对方,商品,收/支,金额(元),支付方式,当前状态,交易单号,商户单号,备注'

/** 造一个微信格式的 CSV：前 16 行是元信息，之后才是表头和数据 */
function buildWechatCsv(rows: string[]): File {
  const meta = Array.from({ length: 16 }, (_, i) => `--------------- 元信息 ${i + 1} ----------------`)
  const text = [...meta, HEADER, ...rows].join('\n')
  return new File([new TextEncoder().encode(text)], '微信支付账单.csv', { type: 'text/csv' })
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
