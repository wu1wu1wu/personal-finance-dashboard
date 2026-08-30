import { describe, it, expect } from 'vitest'
import {
  getWarningLevel,
  getWarningStyle,
  calcBudgetStatus,
  calcTotalBudgetStatus,
} from './budget-engine'
import type { Transaction, Budget } from '@/types'

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

describe('getWarningLevel', () => {
  it('低于 80% 为正常', () => {
    expect(getWarningLevel(0.5)).toBe('normal')
  })

  it('80%-100% 之间为警告', () => {
    expect(getWarningLevel(0.8)).toBe('warning')
    expect(getWarningLevel(0.99)).toBe('warning')
  })

  it('达到 100% 为超支', () => {
    expect(getWarningLevel(1.0)).toBe('exceeded')
    expect(getWarningLevel(1.5)).toBe('exceeded')
  })
})

describe('getWarningStyle', () => {
  it('返回对应文案', () => {
    expect(getWarningStyle('exceeded').label).toBe('已超支')
    expect(getWarningStyle('warning').label).toBe('接近预算')
    expect(getWarningStyle('normal').label).toBe('正常')
  })
})

describe('calcBudgetStatus', () => {
  it('计算分类预算执行状态，跨月交易不计入', () => {
    const txns = [
      makeTxn({ category: '餐饮美食', amount: 60, transactionTime: '2026-07-01 12:00:00' }),
      makeTxn({ category: '餐饮美食', amount: 40, transactionTime: '2026-07-02 12:00:00' }),
      makeTxn({ category: '交通出行', amount: 30, transactionTime: '2026-07-03 12:00:00' }),
      makeTxn({ category: '餐饮美食', amount: 999, transactionTime: '2026-08-01 12:00:00' }),
    ]
    const budgets: Budget[] = [
      { category: '餐饮美食', monthlyLimit: 100, color: '#fff', month: '2026-07' },
      { category: '交通出行', monthlyLimit: 50, color: '#fff', month: '2026-07' },
    ]
    const statuses = calcBudgetStatus(txns, budgets, '2026-07')

    const dining = statuses.find((s) => s.category === '餐饮美食')
    expect(dining?.spent).toBe(100)
    expect(dining?.percentage).toBe(1)
    expect(dining?.level).toBe('exceeded')

    const transport = statuses.find((s) => s.category === '交通出行')
    expect(transport?.spent).toBe(30)
    expect(transport?.percentage).toBe(0.6)
    expect(transport?.level).toBe('normal')
  })
})

describe('calcTotalBudgetStatus', () => {
  it('计算总预算执行状态', () => {
    const txns = [
      makeTxn({ amount: 300, transactionTime: '2026-07-01 12:00:00' }),
      makeTxn({ amount: 200, transactionTime: '2026-07-02 12:00:00' }),
    ]
    const status = calcTotalBudgetStatus(txns, { '2026-07': 1000 }, '2026-07')
    expect(status?.spent).toBe(500)
    expect(status?.percentage).toBe(0.5)
    expect(status?.level).toBe('normal')
  })

  it('无总预算时返回 null', () => {
    expect(calcTotalBudgetStatus([], {}, '2026-07')).toBeNull()
  })
})
