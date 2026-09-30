// ============================================================
// 周期扣款提醒 - 单元测试
// ============================================================
// 约定：
//   - today 一律由用例注入，不依赖系统时间
//   - getPeriodicTransactions 有模块级缓存（比对数组引用），
//     所以每个用例都新建数组，避免复用上一次的识别结果
// ============================================================

import { describe, it, expect } from 'vitest'
import {
  buildRecurringReminders,
  summarizeRecurringReminders,
  daysBetween,
  type RecurringReminder,
} from './recurring-reminder'
import type { Transaction } from '@/types'

/** 构造交易：按 types/index.ts 的必填字段补齐，只覆盖用例关心的部分 */
function makeTxn(overrides: Partial<Transaction> = {}): Transaction {
  return {
    id: 'txn-1',
    transactionTime: '2026-07-05 14:30:00',
    transactionType: '支出',
    counterparty: '',
    description: '',
    amount: 100,
    paymentStatus: '支付成功',
    transactionNo: '',
    paymentMethod: '零钱',
    category: '休闲娱乐',
    categorySource: 'auto',
    origin: 'import',
    isPeriodic: false,
    tags: [],
    createdAt: '2026-07-05 14:30:00',
    coverImage: '',
    theme: '',
    ...overrides,
  }
}

/** 同商户、同金额的扣款序列（date 只写 'yyyy-MM-dd'，时间补 12:00:00） */
function series(
  counterparty: string,
  amount: number,
  dates: string[],
  category = '休闲娱乐',
): Transaction[] {
  return dates.map((d, i) =>
    makeTxn({
      id: `${counterparty}-${i}`,
      counterparty,
      amount,
      category,
      transactionTime: `${d} 12:00:00`,
    }),
  )
}

/** 每次调用都返回新数组（绕开周期识别缓存，也符合真实 store 的行为） */
function videoMonthly(): Transaction[] {
  return series('视频会员', 15, ['2026-05-10', '2026-06-10', '2026-07-10'])
}

describe('daysBetween', () => {
  it('同月', () => {
    expect(daysBetween('2026-07-01', '2026-07-31')).toBe(30)
  })

  it('跨月', () => {
    expect(daysBetween('2026-07-28', '2026-08-03')).toBe(6)
  })

  it('跨年', () => {
    expect(daysBetween('2025-12-30', '2026-01-02')).toBe(3)
  })

  it('返回 to - from，可以为负', () => {
    expect(daysBetween('2026-07-10', '2026-07-05')).toBe(-5)
  })

  it('同一天为 0', () => {
    expect(daysBetween('2026-07-10', '2026-07-10')).toBe(0)
  })

  it('闰年 2 月也算得对', () => {
    expect(daysBetween('2024-02-28', '2024-03-01')).toBe(2)
    expect(daysBetween('2025-02-28', '2025-03-01')).toBe(1)
  })

  it('整年跨度', () => {
    expect(daysBetween('2025-01-01', '2026-01-01')).toBe(365)
  })

  it('非法日期返回 NaN 而不是抛异常', () => {
    expect(daysBetween('2026-02-30', '2026-03-01')).toBeNaN()
    expect(daysBetween('2026-13-01', '2026-03-01')).toBeNaN()
    expect(daysBetween('', '2026-03-01')).toBeNaN()
    expect(daysBetween('2026/03/01', '2026-03-01')).toBeNaN()
  })
})

describe('buildRecurringReminders - 状态判定', () => {
  it('预计扣款日已过 → overdue（该扣没扣）', () => {
    const [r] = buildRecurringReminders({ transactions: videoMonthly(), today: '2026-08-20' })
    expect(r.status).toBe('overdue')
    expect(r.daysUntil).toBe(-10)
    expect(r.lastDate).toBe('2026-07-10')
    expect(r.nextDate).toBe('2026-08-10')
  })

  it('正好是预计扣款日 → due', () => {
    const [r] = buildRecurringReminders({ transactions: videoMonthly(), today: '2026-08-10' })
    expect(r.daysUntil).toBe(0)
    expect(r.status).toBe('due')
  })

  it('dueSoonDays 默认 7，落在窗口内 → due', () => {
    const [r] = buildRecurringReminders({ transactions: videoMonthly(), today: '2026-08-05' })
    expect(r.daysUntil).toBe(5)
    expect(r.status).toBe('due')
  })

  it('超出窗口 → upcoming', () => {
    const [r] = buildRecurringReminders({ transactions: videoMonthly(), today: '2026-07-20' })
    expect(r.daysUntil).toBe(21)
    expect(r.status).toBe('upcoming')
  })

  it('边界：daysUntil 正好等于 dueSoonDays → due（闭区间）', () => {
    const [r] = buildRecurringReminders({ transactions: videoMonthly(), today: '2026-08-03' })
    expect(r.daysUntil).toBe(7)
    expect(r.status).toBe('due')
  })

  it('边界：daysUntil = dueSoonDays + 1 → upcoming', () => {
    const [r] = buildRecurringReminders({ transactions: videoMonthly(), today: '2026-08-02' })
    expect(r.daysUntil).toBe(8)
    expect(r.status).toBe('upcoming')
  })

  it('dueSoonDays 可自定义', () => {
    // 距下次扣款 15 天：默认 7 天窗口下是 upcoming，放宽到 30 天就是 due
    const [wider] = buildRecurringReminders({
      transactions: videoMonthly(),
      today: '2026-07-26',
      dueSoonDays: 30,
    })
    expect(wider.daysUntil).toBe(15)
    expect(wider.status).toBe('due')

    const [defaultWindow] = buildRecurringReminders({
      transactions: videoMonthly(),
      today: '2026-07-26',
    })
    expect(defaultWindow.daysUntil).toBe(15)
    expect(defaultWindow.status).toBe('upcoming')

    const [narrower] = buildRecurringReminders({
      transactions: videoMonthly(),
      today: '2026-08-03',
      dueSoonDays: 3,
    })
    expect(narrower.daysUntil).toBe(7)
    expect(narrower.status).toBe('upcoming')
  })

  it('dueSoonDays = 0 时只有当天算 due', () => {
    const [tomorrow] = buildRecurringReminders({
      transactions: videoMonthly(),
      today: '2026-08-09',
      dueSoonDays: 0,
    })
    expect(tomorrow.daysUntil).toBe(1)
    expect(tomorrow.status).toBe('upcoming')

    const [onDay] = buildRecurringReminders({
      transactions: videoMonthly(),
      today: '2026-08-10',
      dueSoonDays: 0,
    })
    expect(onDay.status).toBe('due')
  })

  it('today 完全由调用方注入（同一份数据换个 today 结果就变）', () => {
    const [a] = buildRecurringReminders({ transactions: videoMonthly(), today: '2026-08-05' })
    const [b] = buildRecurringReminders({ transactions: videoMonthly(), today: '2026-08-20' })
    expect(a.status).toBe('due')
    expect(b.status).toBe('overdue')
  })

  it('基本字段来自周期性识别结果', () => {
    const [r] = buildRecurringReminders({ transactions: videoMonthly(), today: '2026-08-05' })
    expect(r.counterparty).toBe('视频会员')
    expect(r.category).toBe('休闲娱乐')
    expect(r.period).toBe('monthly')
    expect(r.amount).toBe(15)
    expect(r.previousAmount).toBe(15)
    expect(r.priceChanged).toBe(false)
    expect(r.confidence).toBeGreaterThan(0)
  })
})

describe('buildRecurringReminders - 排序与过滤', () => {
  it('先按 daysUntil 升序（最紧急在前）', () => {
    const txns = [
      ...series('C-逾期最久', 20, ['2026-03-20', '2026-04-20', '2026-05-20']),
      ...series('A-还有5天', 30, ['2026-05-10', '2026-06-10', '2026-07-10']),
      ...series('B-已过4天', 50, ['2026-05-01', '2026-06-01', '2026-07-01']),
    ]
    const result = buildRecurringReminders({ transactions: txns, today: '2026-08-05' })
    expect(result.map((r) => r.counterparty)).toEqual(['C-逾期最久', 'B-已过4天', 'A-还有5天'])
    expect(result.map((r) => r.daysUntil)).toEqual([-46, -4, 5])
  })

  it('daysUntil 相同时按金额降序', () => {
    const txns = [
      ...series('小会员', 10, ['2026-05-10', '2026-06-10', '2026-07-10']),
      ...series('大会员', 99, ['2026-05-10', '2026-06-10', '2026-07-10']),
    ]
    const result = buildRecurringReminders({ transactions: txns, today: '2026-08-05' })
    expect(result.every((r) => r.daysUntil === 5)).toBe(true)
    expect(result.map((r) => r.counterparty)).toEqual(['大会员', '小会员'])
  })

  it('ignored 精确匹配 counterparty（不做前缀/模糊匹配）', () => {
    const txns = [
      ...series('视频会员', 15, ['2026-05-10', '2026-06-10', '2026-07-10']),
      ...series('视频会员PLUS', 20, ['2026-05-11', '2026-06-11', '2026-07-11']),
    ]

    expect(buildRecurringReminders({ transactions: txns, today: '2026-08-01' })).toHaveLength(2)
    // '视频' 只是前缀，不该命中
    expect(
      buildRecurringReminders({ transactions: txns, today: '2026-08-01', ignored: ['视频'] }),
    ).toHaveLength(2)

    const rest = buildRecurringReminders({
      transactions: txns,
      today: '2026-08-01',
      ignored: ['视频会员'],
    })
    expect(rest).toHaveLength(1)
    expect(rest[0].counterparty).toBe('视频会员PLUS')
  })

  it('ignored 传空数组等于不过滤', () => {
    expect(
      buildRecurringReminders({ transactions: videoMonthly(), today: '2026-08-01', ignored: [] }),
    ).toHaveLength(1)
  })

  it('同一商户多档金额（引擎会拆成两桶）不会产出重复卡片', () => {
    const txns = [
      ...series('某会员', 200, ['2026-04-15', '2026-05-15', '2026-06-15']),
      ...series('某会员', 500, ['2026-04-20', '2026-05-20', '2026-06-20']),
    ]
    const result = buildRecurringReminders({ transactions: txns, today: '2026-07-01' })
    expect(result).toHaveLength(1)
    expect(result[0].counterparty).toBe('某会员')
    expect(result[0].amount).toBe(500)
  })
})

describe('buildRecurringReminders - 价格变化', () => {
  it('最近一笔明显高于历史均价 → priceChanged 为 true（涨价）', () => {
    const txns = [
      ...series('云盘会员', 30, ['2026-04-05', '2026-05-05', '2026-06-05']),
      makeTxn({
        id: 'rise',
        counterparty: '云盘会员',
        amount: 39,
        transactionTime: '2026-07-05 12:00:00',
      }),
    ]
    const [r] = buildRecurringReminders({ transactions: txns, today: '2026-07-20' })
    expect(r.amount).toBe(39)
    expect(r.previousAmount).toBe(30)
    expect(r.priceChanged).toBe(true)
    expect(r.lastDate).toBe('2026-07-05')
    expect(r.nextDate).toBe('2026-08-05')
    expect(r.status).toBe('upcoming')
  })

  it('降价同样算 priceChanged', () => {
    const txns = [
      ...series('云盘会员', 100, ['2026-04-05', '2026-05-05', '2026-06-05']),
      makeTxn({
        id: 'drop',
        counterparty: '云盘会员',
        amount: 90,
        transactionTime: '2026-07-05 12:00:00',
      }),
    ]
    const [r] = buildRecurringReminders({ transactions: txns, today: '2026-07-20' })
    expect(r.amount).toBe(90)
    expect(r.previousAmount).toBe(100)
    expect(r.priceChanged).toBe(true)
  })

  it('变动在 5% 容差内 → 不算价格变化', () => {
    const txns = [
      ...series('咖啡订阅', 100, ['2026-04-10', '2026-05-10', '2026-06-10']),
      makeTxn({
        id: 'tiny-rise',
        counterparty: '咖啡订阅',
        amount: 104,
        transactionTime: '2026-07-10 12:00:00',
      }),
    ]
    const [r] = buildRecurringReminders({ transactions: txns, today: '2026-07-20' })
    expect(r.previousAmount).toBe(100)
    expect(r.amount).toBe(104)
    // |104-100| = 4，阈值 max(0.5, 100*5%) = 5 → 不算变化
    expect(r.priceChanged).toBe(false)
  })

  it('正好卡在阈值上（严格大于才算变化）', () => {
    const txns = [
      ...series('咖啡订阅', 100, ['2026-04-10', '2026-05-10', '2026-06-10']),
      makeTxn({
        id: 'edge',
        counterparty: '咖啡订阅',
        amount: 105,
        transactionTime: '2026-07-10 12:00:00',
      }),
    ]
    const [r] = buildRecurringReminders({ transactions: txns, today: '2026-07-20' })
    expect(r.priceChanged).toBe(false)
  })

  it('小额订阅用 0.5 元绝对阈值兜底', () => {
    const txns = [
      ...series('小游戏会员', 10, ['2026-04-10', '2026-05-10', '2026-06-10']),
      makeTxn({
        id: 'small-rise',
        counterparty: '小游戏会员',
        amount: 10.8,
        transactionTime: '2026-07-10 12:00:00',
      }),
    ]
    const [r] = buildRecurringReminders({ transactions: txns, today: '2026-07-20' })
    expect(r.previousAmount).toBe(10)
    expect(r.amount).toBe(10.8)
    // |10.8-10| = 0.8 > max(0.5, 0.5) = 0.5
    expect(r.priceChanged).toBe(true)
  })

  it('金额没变 → priceChanged 为 false', () => {
    const [r] = buildRecurringReminders({ transactions: videoMonthly(), today: '2026-08-05' })
    expect(r.amount).toBe(r.previousAmount)
    expect(r.priceChanged).toBe(false)
  })

  it('previousAmount 取同商户全部历史支出（含金额档位不同的笔），保留两位', () => {
    const txns = [
      ...series('视频会员', 29.8, ['2026-04-05']),
      ...series('视频会员', 30, ['2026-05-05']),
      ...series('视频会员', 30.4, ['2026-06-05']),
      makeTxn({
        id: 'latest',
        counterparty: '视频会员',
        amount: 39,
        transactionTime: '2026-07-05 12:00:00',
      }),
    ]
    const [r] = buildRecurringReminders({ transactions: txns, today: '2026-07-20' })
    // (29.8 + 30 + 30.4) / 3 = 30.0666… → 30.07
    expect(r.previousAmount).toBe(30.07)
    expect(r.amount).toBe(39)
    expect(r.priceChanged).toBe(true)
  })

  it('没有历史记录时 previousAmount 为 0（日期不完整的旧记录不参与统计）', () => {
    const txns = [
      ...series('幽灵订阅', 30, ['2026-05', '2026-06']),
      makeTxn({
        id: 'ghost-latest',
        counterparty: '幽灵订阅',
        amount: 30,
        transactionTime: '2026-07-05 12:00:00',
      }),
    ]
    const [r] = buildRecurringReminders({ transactions: txns, today: '2026-07-20' })
    expect(r.previousAmount).toBe(0)
    expect(r.priceChanged).toBe(false)
  })

  it('历史里的收入（负数）不参与均价', () => {
    const txns = [
      ...series('视频会员', 30, ['2026-04-05', '2026-05-05', '2026-06-05']),
      makeTxn({
        id: 'refund',
        counterparty: '视频会员',
        amount: -30,
        transactionTime: '2026-06-20 12:00:00',
      }),
      makeTxn({
        id: 'latest',
        counterparty: '视频会员',
        amount: 45,
        transactionTime: '2026-07-05 12:00:00',
      }),
    ]
    const [r] = buildRecurringReminders({ transactions: txns, today: '2026-07-20' })
    expect(r.previousAmount).toBe(30)
    expect(r.priceChanged).toBe(true)
  })
})

describe('buildRecurringReminders - 跨年与异常输入', () => {
  it('跨年：12 月扣款 + 1 个月 → 次年 1 月', () => {
    const txns = series('域名续费', 68, ['2025-10-30', '2025-11-30', '2025-12-30'])
    const [r] = buildRecurringReminders({ transactions: txns, today: '2025-12-31' })
    expect(r.lastDate).toBe('2025-12-30')
    expect(r.nextDate).toBe('2026-01-30')
    expect(r.daysUntil).toBe(30)
    expect(r.status).toBe('upcoming')
  })

  it('跨年：季度扣款 + 3 个月 → 次年 1 月', () => {
    const txns = series('季度会员', 99, ['2025-04-30', '2025-07-30', '2025-10-30'])
    const [r] = buildRecurringReminders({ transactions: txns, today: '2025-11-05' })
    expect(r.period).toBe('quarterly')
    expect(r.nextDate).toBe('2026-01-30')
    expect(r.daysUntil).toBe(daysBetween('2025-11-05', '2026-01-30'))
  })

  it('空输入 → 空结果', () => {
    expect(buildRecurringReminders({ transactions: [], today: '2026-01-01' })).toEqual([])
  })

  it('没有周期性交易 → 空结果', () => {
    const txns = series('便利店', 12, ['2026-05-01', '2026-06-01'])
    expect(buildRecurringReminders({ transactions: txns, today: '2026-07-01' })).toEqual([])
  })

  it('日期格式非法（不足 3 个月的完整日期）不抛异常，跳过该条', () => {
    const ghost = series('幽灵订户', 30, ['2026-05', '2026-06', '2026-07'])
    expect(() =>
      buildRecurringReminders({ transactions: ghost, today: '2026-07-15' }),
    ).not.toThrow()
    expect(buildRecurringReminders({ transactions: ghost, today: '2026-07-15' })).toEqual([])
  })

  it('异常条目只跳过自己，不影响同一批里的正常条目', () => {
    const txns = [
      ...series('幽灵订户', 30, ['2026-05', '2026-06', '2026-07']),
      ...series('正常会员', 20, ['2026-05-10', '2026-06-10', '2026-07-10']),
    ]
    const result = buildRecurringReminders({ transactions: txns, today: '2026-07-15' })
    expect(result.map((r) => r.counterparty)).toEqual(['正常会员'])
    expect(result[0].nextDate).toBe('2026-08-10')
  })
})

describe('summarizeRecurringReminders', () => {
  function makeReminder(overrides: Partial<RecurringReminder> = {}): RecurringReminder {
    return {
      counterparty: '某会员',
      category: '休闲娱乐',
      amount: 100,
      previousAmount: 100,
      priceChanged: false,
      period: 'monthly',
      lastDate: '2026-07-10',
      nextDate: '2026-08-10',
      daysUntil: 5,
      status: 'due',
      confidence: 0.3,
      ...overrides,
    }
  }

  it('空列表各项为 0', () => {
    expect(summarizeRecurringReminders([])).toEqual({
      dueCount: 0,
      dueTotal: 0,
      overdueCount: 0,
      monthlyTotal: 0,
      reminderCount: 0,
    })
  })

  it('只统计 due 的条数与金额，overdue 单独计数', () => {
    const summary = summarizeRecurringReminders([
      makeReminder({ amount: 30, status: 'due' }),
      makeReminder({ amount: 12.5, status: 'due' }),
      makeReminder({ amount: 999, status: 'overdue' }),
      makeReminder({ amount: 50, status: 'upcoming' }),
    ])
    expect(summary).toEqual({
      dueCount: 2,
      dueTotal: 42.5,
      overdueCount: 1,
      monthlyTotal: 30 + 12.5 + 999 + 50,
      reminderCount: 4,
    })
  })

  it('monthlyTotal = monthly + quarterly/3 + yearly/12，保留两位', () => {
    const summary = summarizeRecurringReminders([
      makeReminder({ amount: 10, period: 'monthly' }),
      makeReminder({ amount: 100, period: 'quarterly' }),
      makeReminder({ amount: 100, period: 'yearly' }),
    ])
    // 10 + 33.333… + 8.333… = 51.666… → 51.67
    expect(summary.monthlyTotal).toBe(51.67)
  })

  it('构建 → 汇总：三种周期混合的每月固定支出', () => {
    const txns = [
      ...series('月度会员', 30, ['2025-05-15', '2025-06-15', '2025-07-15']),
      ...series('季度会员', 90, ['2025-01-15', '2025-04-15', '2025-07-15']),
      ...series('年度会员', 120, ['2023-03-15', '2024-03-15', '2025-03-15']),
    ]
    const reminders = buildRecurringReminders({ transactions: txns, today: '2025-07-20' })
    expect(reminders.map((r) => r.period).sort()).toEqual(['monthly', 'quarterly', 'yearly'])

    const summary = summarizeRecurringReminders(reminders)
    expect(summary).toEqual({
      dueCount: 0,
      dueTotal: 0,
      overdueCount: 0,
      monthlyTotal: 70, // 30 + 90/3 + 120/12
      reminderCount: 3,
    })
  })

  it('构建 → 汇总：dueTotal 只算 due，overdue 只计数', () => {
    const txns = [
      ...series('视频会员', 30, ['2026-05-10', '2026-06-10', '2026-07-10']),
      ...series('音乐会员', 50, ['2026-05-01', '2026-06-01', '2026-07-01']),
      ...series('健身房', 20, ['2026-03-20', '2026-04-20', '2026-05-20']),
    ]
    const summary = summarizeRecurringReminders(
      buildRecurringReminders({ transactions: txns, today: '2026-08-05' }),
    )
    expect(summary).toEqual({
      dueCount: 1,
      dueTotal: 30,
      overdueCount: 2,
      monthlyTotal: 100,
      reminderCount: 3,
    })
  })
})
