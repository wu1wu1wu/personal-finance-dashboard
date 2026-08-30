import { describe, it, expect } from 'vitest'
import {
  detectPeriodicTransactions,
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
