import { describe, it, expect } from 'vitest'
import {
  calcCategoryBreakdown,
  calcDailySpend,
  calcDashboardMetrics,
  calcMonthlyTrend,
} from './dashboard-engine'
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

describe('calcCategoryBreakdown', () => {
  it('按分类汇总当月支出并降序', () => {
    const txns = [
      makeTxn({ category: '餐饮美食', amount: 100, transactionTime: '2026-07-01 12:00:00' }),
      makeTxn({ category: '交通出行', amount: 50, transactionTime: '2026-07-02 12:00:00' }),
      makeTxn({ category: '餐饮美食', amount: 30, transactionTime: '2026-07-03 12:00:00' }),
    ]
    const result = calcCategoryBreakdown(txns, '2026-07')
    expect(result[0].category).toBe('餐饮美食')
    expect(result[0].amount).toBe(130)
    expect(result[1].category).toBe('交通出行')
    expect(result[1].amount).toBe(50)
  })
})

describe('calcDailySpend', () => {
  it('返回当月每一天，含无支出日', () => {
    const txns = [
      makeTxn({ amount: 100, transactionTime: '2026-02-01 12:00:00' }),
    ]
    const days = calcDailySpend(txns, '2026-02')
    expect(days).toHaveLength(28)
    expect(days[0].amount).toBe(100)
    expect(days[1].amount).toBe(0)
  })
})

describe('calcDashboardMetrics', () => {
  it('计算关键指标（支出/收入/最大单笔/笔数）', () => {
    const txns = [
      makeTxn({ amount: 100, transactionTime: '2026-07-01 12:00:00' }),
      makeTxn({ amount: 50, transactionTime: '2026-07-02 12:00:00' }),
      makeTxn({ amount: -200, transactionTime: '2026-07-03 12:00:00' }),
    ]
    const m = calcDashboardMetrics(txns, '2026-07')
    expect(m.totalExpense).toBe(150)
    expect(m.totalIncome).toBe(200)
    expect(m.maxSingle).toBe(100)
    expect(m.transactionCount).toBe(3)
  })
})

describe('calcMonthlyTrend', () => {
  it('返回近 6 个月数据点，空数据时全为 0', () => {
    const trend = calcMonthlyTrend([])
    expect(trend).toHaveLength(6)
    for (const p of trend) {
      expect(p.month).toMatch(/^\d{4}-\d{2}$/)
      expect(p.expense).toBe(0)
      expect(p.income).toBe(0)
    }
  })
})
