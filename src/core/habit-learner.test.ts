import { describe, it, expect } from 'vitest'
import type { Transaction } from '@/types'
import {
  buildHabitModel,
  amountBucketIndex,
  hourBucketIndex,
  MIN_SAMPLES,
  MIN_CONFIDENCE,
} from './habit-learner'

function imported(category: string, amount: number, time: string, id: string): Transaction {
  return {
    id,
    transactionTime: time,
    transactionType: amount > 0 ? '支出' : '收入',
    counterparty: '某商户',
    description: '',
    amount,
    paymentStatus: '',
    transactionNo: `no-${id}`,
    paymentMethod: '',
    category,
    categorySource: 'auto',
    origin: 'import',
    isPeriodic: false,
    tags: [],
    createdAt: '',
    coverImage: '',
  }
}

/** 造 n 条同分类、同金额档、同时段的历史记录 */
function repeat(category: string, amount: number, hour: number, n: number, prefix: string): Transaction[] {
  return Array.from({ length: n }, (_, i) =>
    imported(category, amount, `2026-08-01 ${hour.toString().padStart(2, '0')}:00:00`, `${prefix}-${i}`),
  )
}

describe('分档函数', () => {
  it('金额分档边界', () => {
    expect(amountBucketIndex(3)).toBe(0)
    expect(amountBucketIndex(5)).toBe(1)
    expect(amountBucketIndex(12)).toBe(2)
    expect(amountBucketIndex(23)).toBe(3)
    expect(amountBucketIndex(100)).toBe(5)
    expect(amountBucketIndex(999)).toBe(5)
  })

  it('金额分档对收入取绝对值', () => {
    expect(amountBucketIndex(-23)).toBe(amountBucketIndex(23))
  })

  it('时段分档边界', () => {
    expect(hourBucketIndex(6)).toBe(0)
    expect(hourBucketIndex(9)).toBe(0)
    expect(hourBucketIndex(10)).toBe(1)
    expect(hourBucketIndex(13)).toBe(1)
    expect(hourBucketIndex(15)).toBe(2)
    expect(hourBucketIndex(19)).toBe(3)
    expect(hourBucketIndex(23)).toBe(4)
    expect(hourBucketIndex(2)).toBe(4)
  })
})

describe('buildHabitModel', () => {
  it('样本不足时不预测', () => {
    const history = repeat('餐饮美食', 23, 12, MIN_SAMPLES - 1, 'a')
    const model = buildHabitModel(history)
    expect(model.predict(imported('待确认', 23, '2026-09-01 12:30:00', 'x'))).toBeNull()
  })

  it('样本足够且占比达标时给出预测', () => {
    const history = repeat('餐饮美食', 23, 12, 5, 'a')
    const model = buildHabitModel(history)
    const r = model.predict(imported('待确认', 25, '2026-09-01 12:30:00', 'x'))
    expect(r?.category).toBe('餐饮美食')
    expect(r?.confidence).toBe(1)
  })

  it('分类占比不够高时不预测', () => {
    const history = [
      ...repeat('餐饮美食', 23, 12, 3, 'a'),
      ...repeat('购物消费', 23, 12, 3, 'b'),
    ]
    const model = buildHabitModel(history)
    expect(model.predict(imported('待确认', 23, '2026-09-01 12:30:00', 'x'))).toBeNull()
  })

  it('占比刚好达到阈值时预测', () => {
    // 7 餐饮 : 3 购物 = 0.7
    const history = [
      ...repeat('餐饮美食', 23, 12, 7, 'a'),
      ...repeat('购物消费', 23, 12, 3, 'b'),
    ]
    const model = buildHabitModel(history)
    const r = model.predict(imported('待确认', 23, '2026-09-01 12:30:00', 'x'))
    expect(r?.category).toBe('餐饮美食')
    expect(r?.confidence).toBeCloseTo(MIN_CONFIDENCE, 5)
  })

  it('时段不同不串档（深夜的规律不会套到中午）', () => {
    const history = repeat('休闲娱乐', 80, 23, 6, 'a')
    const model = buildHabitModel(history)
    expect(model.predict(imported('待确认', 80, '2026-09-01 12:00:00', 'x'))).toBeNull()
  })

  it('金额档不同不串档', () => {
    const history = repeat('餐饮美食', 23, 12, 6, 'a')
    const model = buildHabitModel(history)
    expect(model.predict(imported('待确认', 300, '2026-09-01 12:00:00', 'x'))).toBeNull()
  })

  it('只使用账单导入的记录训练（占位与推测记录被忽略）', () => {
    const placeholders = repeat('餐饮美食', 23, 12, 10, 'p').map((t) => ({
      ...t,
      origin: 'auto' as const,
    }))
    const model = buildHabitModel(placeholders)
    expect(model.stats.samples).toBe(0)
    expect(model.predict(imported('待确认', 23, '2026-09-01 12:30:00', 'x'))).toBeNull()
  })

  it('待确认的历史记录不参与训练', () => {
    const history = repeat('待确认', 23, 12, 10, 'a')
    const model = buildHabitModel(history)
    expect(model.stats.samples).toBe(0)
  })

  it('损坏的时间不参与训练', () => {
    const history = repeat('餐饮美食', 23, 12, 6, 'a')
    history[0] = { ...history[0], transactionTime: 'bad' }
    const model = buildHabitModel(history)
    expect(model.stats.samples).toBe(5)
  })

  it('统计训练样本与分桶数量', () => {
    const history = [
      ...repeat('餐饮美食', 23, 12, 3, 'a'),
      ...repeat('交通出行', 3, 8, 2, 'b'),
    ]
    const model = buildHabitModel(history)
    expect(model.stats).toEqual({ samples: 5, buckets: 2 })
  })
})
