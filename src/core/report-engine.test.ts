import { describe, it, expect } from 'vitest'
import { buildMonthlyReport, elapsedDaysInMonth, previousMonth } from './report-engine'
import { getCurrentMonth } from '@/utils/date'
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
    category: '餐饮美食',
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

/** 该月天数（测试里独立算一遍，避免和被测函数的实现互相印证） */
function daysOf(month: string): number {
  const [y, m] = month.split('-').map(Number)
  return new Date(y, m, 0).getDate()
}

describe('previousMonth', () => {
  it('跨年回退：2026-01 → 2025-12', () => {
    expect(previousMonth('2026-01')).toBe('2025-12')
  })

  it('普通月份：2026-07 → 2026-06', () => {
    expect(previousMonth('2026-07')).toBe('2026-06')
  })

  it('非法月份返回空串，不抛异常', () => {
    expect(previousMonth('2026-13')).toBe('')
    expect(previousMonth('')).toBe('')
    expect(previousMonth('abc')).toBe('')
  })
})

describe('elapsedDaysInMonth', () => {
  it('今天所在月取今天的日号', () => {
    expect(elapsedDaysInMonth('2026-07', '2026-07-15')).toBe(15)
    expect(elapsedDaysInMonth('2026-07', '2026-07-01')).toBe(1)
  })

  it('早于今天所在月取整月天数（含闰年 2 月）', () => {
    expect(elapsedDaysInMonth('2026-02', '2026-07-15')).toBe(28)
    expect(elapsedDaysInMonth('2024-02', '2026-07-15')).toBe(29)
    expect(elapsedDaysInMonth('2026-07', '2027-01-03')).toBe(31)
  })

  it('未来月份为 0', () => {
    expect(elapsedDaysInMonth('2026-08', '2026-07-15')).toBe(0)
    expect(elapsedDaysInMonth('2027-01', '2026-07-15')).toBe(0)
  })

  it('非法月份为 0', () => {
    expect(elapsedDaysInMonth('2026-13', '2026-07-15')).toBe(0)
  })
})

describe('buildMonthlyReport 基础汇总', () => {
  it('空数据：hasData=false，各项为 0，日度仍是整月', () => {
    const report = buildMonthlyReport({
      transactions: [],
      month: '2026-07',
      today: '2026-07-10',
    })

    expect(report.month).toBe('2026-07')
    expect(report.hasData).toBe(false)
    expect(report.income).toBe(0)
    expect(report.expense).toBe(0)
    expect(report.net).toBe(0)
    expect(report.transactionCount).toBe(0)
    expect(report.consumptionCount).toBe(0)
    expect(report.pendingCount).toBe(0)
    expect(report.elapsedDays).toBe(10)
    expect(report.dailyAverage).toBe(0)
    expect(report.largestExpense).toBeNull()
    expect(report.topCategories).toEqual([])
    expect(report.periodics).toEqual([])
    expect(report.budget).toBeNull()
    expect(report.previous).toEqual({ income: 0, expense: 0, net: 0 })
    expect(report.deltas).toEqual({ income: null, expense: null, net: null })
    expect(report.daily).toHaveLength(31)
    for (const d of report.daily) {
      expect(d.expense).toBe(0)
      expect(d.income).toBe(0)
    }
  })

  it('expense 只算消费：排除转账与「不计收支」记录；income 取负数绝对值', () => {
    const txns = [
      makeTxn({ id: 'a', amount: 100, category: '餐饮美食' }),
      makeTxn({ id: 'b', amount: 500, category: '转账' }),
      makeTxn({ id: 'c', amount: 200, category: '其他', transactionType: '其他' }),
      makeTxn({ id: 'd', amount: -300, category: '收入', transactionType: '收入' }),
    ]

    const report = buildMonthlyReport({ transactions: txns, month: '2026-07', today: '2026-07-10' })

    expect(report.hasData).toBe(true)
    expect(report.expense).toBe(100)
    expect(report.consumptionCount).toBe(1)
    expect(report.income).toBe(300)
    expect(report.net).toBe(200)
    expect(report.transactionCount).toBe(4)
  })

  it('只统计目标月份，其他月份不参与', () => {
    const txns = [
      makeTxn({ id: 'a', amount: 100, transactionTime: '2026-07-31 23:59:59' }),
      makeTxn({ id: 'b', amount: 999, transactionTime: '2026-06-30 23:59:59' }),
      makeTxn({ id: 'c', amount: 888, transactionTime: '2026-08-01 00:00:00' }),
    ]

    const report = buildMonthlyReport({ transactions: txns, month: '2026-07', today: '2026-07-10' })

    expect(report.transactionCount).toBe(1)
    expect(report.expense).toBe(100)
  })

  it('金额四舍五入到两位小数', () => {
    const txns = [
      makeTxn({ id: 'a', amount: 0.1 }),
      makeTxn({ id: 'b', amount: 0.2 }),
      makeTxn({ id: 'c', amount: -0.35, category: '收入', transactionType: '收入' }),
      makeTxn({ id: 'd', amount: 33.333 }),
    ]

    const report = buildMonthlyReport({ transactions: txns, month: '2026-07', today: '2026-07-10' })

    expect(report.expense).toBe(33.63)
    expect(report.income).toBe(0.35)
    expect(report.net).toBe(-33.28)
  })

  it('pendingCount 统计分类为空的记录数', () => {
    const txns = [
      makeTxn({ id: 'a', category: '', amount: 10 }),
      makeTxn({ id: 'b', category: '', amount: 20 }),
      makeTxn({ id: 'c', category: '餐饮美食', amount: 30 }),
    ]

    const report = buildMonthlyReport({ transactions: txns, month: '2026-07', today: '2026-07-10' })

    expect(report.pendingCount).toBe(2)
    expect(report.transactionCount).toBe(3)
  })

  it('dailyAverage = expense / elapsedDays，保留两位', () => {
    const txns = [makeTxn({ amount: 100 })]
    const report = buildMonthlyReport({ transactions: txns, month: '2026-07', today: '2026-07-15' })

    expect(report.elapsedDays).toBe(15)
    expect(report.dailyAverage).toBe(6.67)
  })

  it('未来月份 elapsedDays 与 dailyAverage 为 0', () => {
    const txns = [makeTxn({ amount: 100, transactionTime: '2026-08-03 10:00:00' })]
    const report = buildMonthlyReport({ transactions: txns, month: '2026-08', today: '2026-07-15' })

    expect(report.hasData).toBe(true)
    expect(report.elapsedDays).toBe(0)
    expect(report.dailyAverage).toBe(0)
    expect(report.daily).toHaveLength(daysOf('2026-08'))
  })

  it('不传 today 时默认今天，当月 elapsedDays 落在 1..31', () => {
    const month = getCurrentMonth()
    const report = buildMonthlyReport({ transactions: [], month })

    expect(report.elapsedDays).toBeGreaterThanOrEqual(1)
    expect(report.elapsedDays).toBeLessThanOrEqual(31)
  })
})

describe('largestExpense', () => {
  it('取该月最大的消费支出，忽略转账', () => {
    const txns = [
      makeTxn({ id: 'a', amount: 100, counterparty: '超市', description: '日用品', transactionTime: '2026-07-02 10:00:00' }),
      makeTxn({ id: 'b', amount: 800, category: '转账', counterparty: '朋友', transactionTime: '2026-07-03 10:00:00' }),
      makeTxn({ id: 'c', amount: 300, counterparty: '餐厅', description: '聚餐', transactionTime: '2026-07-04 10:00:00' }),
    ]

    const report = buildMonthlyReport({ transactions: txns, month: '2026-07', today: '2026-07-10' })

    expect(report.largestExpense).toEqual({
      id: 'c',
      counterparty: '餐厅',
      description: '聚餐',
      amount: 300,
      date: '2026-07-04',
    })
  })

  it('金额并列时取时间最晚的一笔', () => {
    const txns = [
      makeTxn({ id: 'early', amount: 300, counterparty: 'A', transactionTime: '2026-07-01 09:00:00' }),
      makeTxn({ id: 'late', amount: 300, counterparty: 'B', transactionTime: '2026-07-09 23:00:00' }),
      makeTxn({ id: 'mid', amount: 300, counterparty: 'C', transactionTime: '2026-07-05 09:00:00' }),
    ]

    const report = buildMonthlyReport({ transactions: txns, month: '2026-07', today: '2026-07-10' })

    expect(report.largestExpense?.id).toBe('late')
  })

  it('没有消费支出时为 null', () => {
    const txns = [
      makeTxn({ id: 'a', amount: 500, category: '转账' }),
      makeTxn({ id: 'b', amount: -200, category: '收入', transactionType: '收入' }),
    ]

    const report = buildMonthlyReport({ transactions: txns, month: '2026-07', today: '2026-07-10' })

    expect(report.largestExpense).toBeNull()
  })
})

describe('topCategories', () => {
  it('最多返回 5 条，按金额降序，percentage 沿用分类占比', () => {
    const names = ['餐饮美食', '交通出行', '购物消费', '休闲娱乐', '居住生活', '医疗健康']
    const amounts = [600, 500, 400, 300, 200, 100]
    const txns = names.map((category, i) =>
      makeTxn({ id: `t-${i}`, category, amount: amounts[i] }),
    )

    const report = buildMonthlyReport({ transactions: txns, month: '2026-07', today: '2026-07-10' })

    expect(report.topCategories).toHaveLength(5)
    expect(report.topCategories.map((r) => r.category)).toEqual(names.slice(0, 5))
    // 600 / 2100 = 28.5714…% → 28.6（与 calcCategoryBreakdown 的保留一位小数一致）
    expect(report.topCategories[0]).toEqual({
      category: '餐饮美食',
      amount: 600,
      count: 1,
      percentage: 28.6,
    })
    // 医疗健康（100）被挤出前 5
    expect(report.topCategories.some((r) => r.category === '医疗健康')).toBe(false)
  })

  it('同分类多笔合并金额与笔数', () => {
    const txns = [
      makeTxn({ id: 'a', category: '餐饮美食', amount: 75 }),
      makeTxn({ id: 'b', category: '餐饮美食', amount: 25 }),
      makeTxn({ id: 'c', category: '交通出行', amount: 100, transactionTime: '2026-07-06 10:00:00' }),
    ]

    const report = buildMonthlyReport({ transactions: txns, month: '2026-07', today: '2026-07-10' })

    expect(report.topCategories[0]).toEqual({
      category: '餐饮美食',
      amount: 100,
      count: 2,
      percentage: 50,
    })
  })

  it('没有消费支出时为空数组', () => {
    const txns = [makeTxn({ amount: 500, category: '转账' })]
    const report = buildMonthlyReport({ transactions: txns, month: '2026-07', today: '2026-07-10' })

    expect(report.topCategories).toEqual([])
  })
})

describe('previous 与 deltas', () => {
  it('上月数据按同口径统计（转账不计支出）', () => {
    const txns = [
      makeTxn({ id: 'jul', amount: 200, transactionTime: '2026-07-05 10:00:00' }),
      makeTxn({ id: 'jun-e', amount: 100, transactionTime: '2026-06-05 10:00:00' }),
      makeTxn({ id: 'jun-t', amount: 900, category: '转账', transactionTime: '2026-06-06 10:00:00' }),
      makeTxn({ id: 'jun-i', amount: -300, category: '收入', transactionType: '收入', transactionTime: '2026-06-07 10:00:00' }),
    ]

    const report = buildMonthlyReport({ transactions: txns, month: '2026-07', today: '2026-07-10' })

    expect(report.previous).toEqual({ income: 300, expense: 100, net: 200 })
    expect(report.expense).toBe(200)
    expect(report.income).toBe(0)
    expect(report.net).toBe(-200)
  })

  it('环比正负：收入下降为负、支出上升为正', () => {
    const txns = [
      makeTxn({ id: 'jun-e', amount: 100, transactionTime: '2026-06-05 10:00:00' }),
      makeTxn({ id: 'jun-i', amount: -300, category: '收入', transactionType: '收入', transactionTime: '2026-06-06 10:00:00' }),
      makeTxn({ id: 'jul-e', amount: 120, transactionTime: '2026-07-05 10:00:00' }),
    ]

    const report = buildMonthlyReport({ transactions: txns, month: '2026-07', today: '2026-07-10' })

    expect(report.previous).toEqual({ income: 300, expense: 100, net: 200 })
    expect(report.deltas.expense).toBe(20)
    expect(report.deltas.income).toBe(-100)
    // net: 200 → -120，分母用 |200|
    expect(report.deltas.net).toBe(-160)
  })

  it('上月为 0 时对应环比为 null，两边都为 0 也为 null', () => {
    const txns = [
      makeTxn({ id: 'jun-e', amount: 100, transactionTime: '2026-06-05 10:00:00' }),
      makeTxn({ id: 'jul-e', amount: 120, transactionTime: '2026-07-05 10:00:00' }),
      makeTxn({ id: 'jul-i', amount: -50, category: '收入', transactionType: '收入', transactionTime: '2026-07-06 10:00:00' }),
    ]

    const report = buildMonthlyReport({ transactions: txns, month: '2026-07', today: '2026-07-10' })

    // 上月收入 0 → null；支出上月非 0 → 20
    expect(report.deltas.income).toBeNull()
    expect(report.deltas.expense).toBe(20)
    // previous 无数据、本月也无数据的月份两者都为 0
    const empty = buildMonthlyReport({ transactions: [], month: '2026-07', today: '2026-07-10' })
    expect(empty.deltas.net).toBeNull()
  })

  it('环比保留一位小数', () => {
    const txns = [
      makeTxn({ id: 'jun-e', amount: 300, transactionTime: '2026-06-05 10:00:00' }),
      makeTxn({ id: 'jul-e', amount: 310, transactionTime: '2026-07-05 10:00:00' }),
    ]

    const report = buildMonthlyReport({ transactions: txns, month: '2026-07', today: '2026-07-10' })

    expect(report.deltas.expense).toBe(3.3)
  })
})

describe('daily', () => {
  it('覆盖当月每一天（缺失补 0），支出排除转账、收入按负数计', () => {
    const txns = [
      makeTxn({ id: 'a', amount: 100, transactionTime: '2026-02-01 09:00:00' }),
      makeTxn({ id: 'b', amount: 500, category: '转账', transactionTime: '2026-02-01 10:00:00' }),
      makeTxn({ id: 'c', amount: -50, category: '收入', transactionType: '收入', transactionTime: '2026-02-01 11:00:00' }),
      makeTxn({ id: 'd', amount: 200, transactionTime: '2026-02-14 09:00:00' }),
    ]

    const report = buildMonthlyReport({ transactions: txns, month: '2026-02', today: '2026-07-15' })

    expect(report.daily).toHaveLength(28)
    expect(report.daily[0]).toEqual({ day: '2026-02-01', expense: 100, income: 50 })
    expect(report.daily[13]).toEqual({ day: '2026-02-14', expense: 200, income: 0 })
    expect(report.daily[1]).toEqual({ day: '2026-02-02', expense: 0, income: 0 })
    expect(report.daily[27]).toEqual({ day: '2026-02-28', expense: 0, income: 0 })
  })
})

describe('periodics', () => {
  it('按商户去重取金额最大的一笔，并按金额降序', () => {
    const txns = [
      makeTxn({ id: 'a', counterparty: '网易云音乐', amount: 15, isPeriodic: true, transactionTime: '2026-07-05 09:00:00' }),
      makeTxn({ id: 'b', counterparty: '网易云音乐', amount: 25, isPeriodic: true, transactionTime: '2026-07-20 09:00:00' }),
      makeTxn({ id: 'c', counterparty: '网易云音乐', amount: 25, isPeriodic: true, transactionTime: '2026-07-22 09:00:00' }),
      makeTxn({ id: 'd', counterparty: '中国移动', amount: 100, isPeriodic: true, transactionTime: '2026-07-01 09:00:00' }),
      makeTxn({ id: 'e', counterparty: '超市', amount: 300, isPeriodic: false, transactionTime: '2026-07-10 09:00:00' }),
    ]

    const report = buildMonthlyReport({ transactions: txns, month: '2026-07', today: '2026-07-25' })

    expect(report.periodics).toEqual([
      { counterparty: '中国移动', amount: 100, period: 'monthly', lastDate: '2026-07-01' },
      { counterparty: '网易云音乐', amount: 25, period: 'monthly', lastDate: '2026-07-22' },
    ])
  })

  it('只统计当月实际发生的周期性交易', () => {
    const txns = [
      makeTxn({ id: 'a', counterparty: '房租', amount: 2000, isPeriodic: true, transactionTime: '2026-06-05 09:00:00' }),
      makeTxn({ id: 'b', counterparty: '房租', amount: 2000, isPeriodic: true, transactionTime: '2026-07-05 09:00:00' }),
    ]

    const report = buildMonthlyReport({ transactions: txns, month: '2026-07', today: '2026-07-25' })

    expect(report.periodics).toHaveLength(1)
    expect(report.periodics[0].lastDate).toBe('2026-07-05')
  })

  it('按历史月份间隔推断周期：monthly / quarterly / yearly', () => {
    const monthly = [5, 6, 7].map((m) =>
      makeTxn({ id: `m-${m}`, counterparty: '每月缴费', amount: 30, isPeriodic: true, transactionTime: `2026-0${m}-01 09:00:00` }),
    )
    const quarterly = [1, 4, 7].map((m) =>
      makeTxn({ id: `q-${m}`, counterparty: '季度服务', amount: 60, isPeriodic: true, transactionTime: `2026-0${m}-10 09:00:00` }),
    )
    const yearly = ['2025-07-10', '2026-07-10'].map((d, i) =>
      makeTxn({ id: `y-${i}`, counterparty: '年度保险', amount: 90, isPeriodic: true, transactionTime: `${d} 09:00:00` }),
    )

    const report = buildMonthlyReport({
      transactions: [...monthly, ...quarterly, ...yearly],
      month: '2026-07',
      today: '2026-07-25',
    })

    const byName = Object.fromEntries(report.periodics.map((r) => [r.counterparty, r.period]))
    expect(byName['每月缴费']).toBe('monthly')
    expect(byName['季度服务']).toBe('quarterly')
    expect(byName['年度保险']).toBe('yearly')
    expect(report.periodics.map((r) => r.amount)).toEqual([90, 60, 30])
  })

  it('没有周期性交易时为空数组', () => {
    const txns = [makeTxn({ amount: 100, isPeriodic: false })]
    const report = buildMonthlyReport({ transactions: txns, month: '2026-07', today: '2026-07-25' })

    expect(report.periodics).toEqual([])
  })
})

describe('budget', () => {
  it('未传 totalBudgets 时为 null', () => {
    const txns = [makeTxn({ amount: 100 })]
    const report = buildMonthlyReport({ transactions: txns, month: '2026-07', today: '2026-07-10' })

    expect(report.budget).toBeNull()
  })

  it('传了但没有可用预算（返回 null）时为 null', () => {
    const txns = [makeTxn({ amount: 100 })]
    const report = buildMonthlyReport({
      transactions: txns,
      month: '2026-07',
      totalBudgets: {},
      today: '2026-07-10',
    })

    expect(report.budget).toBeNull()
  })

  it('有预算时给出 limit / spent / percentage / level', () => {
    const txns = [makeTxn({ amount: 850 }), makeTxn({ id: 'b', amount: 150, category: '交通出行' })]
    const report = buildMonthlyReport({
      transactions: txns,
      month: '2026-07',
      totalBudgets: { '2026-07': 1000 },
      today: '2026-07-10',
    })

    // percentage 沿用 calcTotalBudgetStatus 的比例口径（0-1+），与预算页一致
    expect(report.budget).toEqual({
      limit: 1000,
      spent: 1000,
      percentage: 1,
      level: 'exceeded',
    })
  })

  it('预算档位：normal / warning', () => {
    const txns = [makeTxn({ amount: 100 })]
    const normal = buildMonthlyReport({
      transactions: txns,
      month: '2026-07',
      totalBudgets: { '2026-07': 1000 },
      today: '2026-07-10',
    })
    expect(normal.budget?.level).toBe('normal')

    const warning = buildMonthlyReport({
      transactions: [makeTxn({ amount: 850 })],
      month: '2026-07',
      totalBudgets: { '2026-07': 1000 },
      today: '2026-07-10',
    })
    expect(warning.budget?.level).toBe('warning')
  })

  it('通用预算（空字符串键）也生效，且只算消费支出', () => {
    const txns = [
      makeTxn({ id: 'a', amount: 0.1 }),
      makeTxn({ id: 'b', amount: 0.2 }),
      makeTxn({ id: 'c', amount: 500, category: '转账' }),
    ]
    const report = buildMonthlyReport({
      transactions: txns,
      month: '2026-07',
      totalBudgets: { '': 10 },
      today: '2026-07-10',
    })

    expect(report.budget?.limit).toBe(10)
    expect(report.budget?.spent).toBe(0.3)
    expect(report.budget?.percentage).toBeCloseTo(0.03, 10)
    expect(report.budget?.level).toBe('normal')
  })
})

describe('非法月份', () => {
  it("'2026-13' 安全返回，hasData=false 且不抛异常", () => {
    const txns = [makeTxn({ amount: 100 })]

    const report = buildMonthlyReport({ transactions: txns, month: '2026-13', today: '2026-07-15' })

    expect(report.month).toBe('2026-13')
    expect(report.hasData).toBe(false)
    expect(report.income).toBe(0)
    expect(report.expense).toBe(0)
    expect(report.net).toBe(0)
    expect(report.transactionCount).toBe(0)
    expect(report.elapsedDays).toBe(0)
    expect(report.dailyAverage).toBe(0)
    expect(report.daily).toEqual([])
    expect(report.topCategories).toEqual([])
    expect(report.periodics).toEqual([])
    expect(report.largestExpense).toBeNull()
    expect(report.deltas).toEqual({ income: null, expense: null, net: null })
    expect(report.budget).toBeNull()
  })
})
