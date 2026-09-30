import { describe, it, expect } from 'vitest'
import {
  detectPeriodicTransactions,
  getPeriodicTransactions,
  markPeriodicTransactions,
  calcPeriodicBreakdown,
} from './periodic-engine'
import type { Transaction } from '@/types'

function makeTxn(overrides: Partial<Transaction> = {}): Transaction {
  return {
    id: 'txn-1',
    transactionTime: '2026-07-05 14:30:00',
    transactionType: '支出',
    counterparty: '',
    description: '',
    amount: 100,
    paymentStatus: '',
    transactionNo: '',
    paymentMethod: '',
    category: '',
    categorySource: 'auto',
    isPeriodic: false,
    tags: [],
    createdAt: '',
    coverImage: '',
    theme: '',
    origin: 'import',
    ...overrides,
  }
}

describe('detectPeriodicTransactions', () => {
  it('连续 3 个月的固定支出识别为月度周期', () => {
    const txns = [
      makeTxn({ counterparty: '房租', amount: 2000, transactionTime: '2026-05-05 12:00:00' }),
      makeTxn({ counterparty: '房租', amount: 2000, transactionTime: '2026-06-05 12:00:00' }),
      makeTxn({ counterparty: '房租', amount: 2000, transactionTime: '2026-07-05 12:00:00' }),
    ]
    const result = detectPeriodicTransactions(txns)
    expect(result).toHaveLength(1)
    expect(result[0].counterparty).toBe('房租')
    expect(result[0].period).toBe('monthly')
    expect(result[0].lastDate).toBe('2026-07-05')
    expect(result[0].nextDate).toBe('2026-08-05')
  })

  it('不足 3 个月不识别为周期', () => {
    const txns = [
      makeTxn({ counterparty: '房租', amount: 2000, transactionTime: '2026-06-05 12:00:00' }),
      makeTxn({ counterparty: '房租', amount: 2000, transactionTime: '2026-07-05 12:00:00' }),
    ]
    expect(detectPeriodicTransactions(txns)).toHaveLength(0)
  })

  it('月末交易加一个月时收敛到目标月最后一天', () => {
    const txns = [
      makeTxn({ counterparty: '房租', amount: 2000, transactionTime: '2026-01-31 12:00:00' }),
      makeTxn({ counterparty: '房租', amount: 2000, transactionTime: '2026-02-28 12:00:00' }),
      makeTxn({ counterparty: '房租', amount: 2000, transactionTime: '2026-03-31 12:00:00' }),
    ]
    const result = detectPeriodicTransactions(txns)
    expect(result).toHaveLength(1)
    expect(result[0].nextDate).toBe('2026-04-30')
  })
})

describe('同商户多档金额', () => {
  it('金额差超过容差就分成两组', () => {
    const txns = [
      makeTxn({ id: 'a1', counterparty: '某会员', amount: 200, transactionTime: '2026-05-01 10:00:00' }),
      makeTxn({ id: 'a2', counterparty: '某会员', amount: 200, transactionTime: '2026-06-01 10:00:00' }),
      makeTxn({ id: 'a3', counterparty: '某会员', amount: 200, transactionTime: '2026-07-01 10:00:00' }),
      makeTxn({ id: 'b1', counterparty: '某会员', amount: 500, transactionTime: '2026-05-02 10:00:00' }),
      makeTxn({ id: 'b2', counterparty: '某会员', amount: 500, transactionTime: '2026-06-02 10:00:00' }),
      makeTxn({ id: 'b3', counterparty: '某会员', amount: 500, transactionTime: '2026-07-02 10:00:00' }),
    ]

    const result = detectPeriodicTransactions(txns)

    expect(result).toHaveLength(2)
    expect(result.map((r) => r.amount).sort((x, y) => x - y)).toEqual([200, 500])
  })

  it('容差内的金额合并成一组（±1 元，如手续费微调）', () => {
    const txns = [
      makeTxn({ id: 'a1', counterparty: '某会员', amount: 200, transactionTime: '2026-05-01 10:00:00' }),
      makeTxn({ id: 'a2', counterparty: '某会员', amount: 200.5, transactionTime: '2026-06-01 10:00:00' }),
      makeTxn({ id: 'a3', counterparty: '某会员', amount: 201, transactionTime: '2026-07-01 10:00:00' }),
    ]

    expect(detectPeriodicTransactions(txns)).toHaveLength(1)
  })

  it('不同商户的同额支出不会混成一组', () => {
    const txns = [
      makeTxn({ counterparty: '房东A', amount: 2000, transactionTime: '2026-05-05 10:00:00' }),
      makeTxn({ counterparty: '房东B', amount: 2000, transactionTime: '2026-06-05 10:00:00' }),
      makeTxn({ counterparty: '房东C', amount: 2000, transactionTime: '2026-07-05 10:00:00' }),
    ]

    expect(detectPeriodicTransactions(txns)).toHaveLength(0)
  })
})

describe('getPeriodicTransactions（按引用缓存）', () => {
  it('同一份数组引用只算一次', () => {
    const txns = [
      makeTxn({ counterparty: '房租', amount: 2000, transactionTime: '2026-05-05 12:00:00' }),
      makeTxn({ counterparty: '房租', amount: 2000, transactionTime: '2026-06-05 12:00:00' }),
      makeTxn({ counterparty: '房租', amount: 2000, transactionTime: '2026-07-05 12:00:00' }),
    ]

    const first = getPeriodicTransactions(txns)
    const second = getPeriodicTransactions(txns)

    expect(second).toBe(first)
    expect(first).toHaveLength(1)
  })

  it('换了新数组会重算', () => {
    const before = [makeTxn({ counterparty: '房租', amount: 2000, transactionTime: '2026-07-05 12:00:00' })]
    getPeriodicTransactions(before)

    const after = [
      ...before,
      makeTxn({ counterparty: '房租', amount: 2000, transactionTime: '2026-08-05 12:00:00' }),
      makeTxn({ counterparty: '房租', amount: 2000, transactionTime: '2026-09-05 12:00:00' }),
    ]

    expect(getPeriodicTransactions(after)).toHaveLength(1)
  })
})

describe('markPeriodicTransactions', () => {
  const periodic = [
    { counterparty: '房租', amount: 2000, category: '居住生活', period: 'monthly' as const, lastDate: '2026-07-05', nextDate: '2026-08-05', confidence: 0.8 },
  ]

  it('按商户 + 金额容差标记，跳过已标记与收入', () => {
    const txns = [
      makeTxn({ id: 't1', counterparty: '房租', amount: 2000 }),
      makeTxn({ id: 't2', counterparty: '房租', amount: 2000.5 }),
      makeTxn({ id: 't3', counterparty: '房租', amount: 2000, isPeriodic: true }),
      makeTxn({ id: 't4', counterparty: '房租', amount: -2000 }),
      makeTxn({ id: 't5', counterparty: '别的商户', amount: 2000 }),
      makeTxn({ id: 't6', counterparty: '房租', amount: 2005 }),
    ]

    expect(markPeriodicTransactions(txns, periodic).sort()).toEqual(['t1', 't2'])
  })

  it('同一笔被多条周期记录命中时只返回一次', () => {
    const txns = [makeTxn({ id: 't1', counterparty: '房租', amount: 2000 })]
    const twoPeriodics = [
      periodic[0],
      { ...periodic[0], amount: 2000.5 },
    ]

    expect(markPeriodicTransactions(txns, twoPeriodics)).toEqual(['t1'])
  })

  it('没有周期记录时返回空数组', () => {
    expect(markPeriodicTransactions([makeTxn({ id: 't1' })], [])).toEqual([])
  })
})

describe('calcPeriodicBreakdown', () => {
  it('区分固定与弹性开销', () => {
    const txns = [
      makeTxn({ amount: 100, isPeriodic: true, transactionTime: '2026-07-01 12:00:00' }),
      makeTxn({ amount: 300, isPeriodic: false, transactionTime: '2026-07-02 12:00:00' }),
    ]
    const b = calcPeriodicBreakdown(txns, '2026-07')
    expect(b.fixedAmount).toBe(100)
    expect(b.flexibleAmount).toBe(300)
    expect(b.fixedCount).toBe(1)
    expect(b.flexibleCount).toBe(1)
  })
})
