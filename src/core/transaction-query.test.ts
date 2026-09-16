import { describe, it, expect } from 'vitest'
import type { Transaction } from '@/types'
import {
  getAvailableMonths,
  queryTransactions,
  summarizeTransactions,
} from './transaction-query'

function txn(partial: Partial<Transaction> & Pick<Transaction, 'id'>): Transaction {
  return {
    transactionTime: '2026-09-01 12:00:00',
    transactionType: '支出',
    counterparty: '',
    description: '',
    amount: 10,
    paymentStatus: '',
    transactionNo: '',
    paymentMethod: '',
    category: '其他',
    categorySource: 'auto',
    isPeriodic: false,
    tags: [],
    createdAt: '2026-09-01T00:00:00.000Z',
    coverImage: '',
    ...partial,
  }
}

const data: Transaction[] = [
  txn({ id: 'a', transactionTime: '2026-09-10 08:00:00', amount: 30, counterparty: '肯德基', category: '餐饮美食' }),
  txn({ id: 'b', transactionTime: '2026-09-11 09:00:00', amount: -5000, counterparty: '公司', transactionType: '收入', category: '转账' }),
  txn({ id: 'c', transactionTime: '2026-09-12 10:00:00', amount: 100, counterparty: '京东', description: '数码配件', category: '购物消费' }),
  txn({ id: 'd', transactionTime: '2026-08-01 10:00:00', amount: 20, counterparty: '地铁', category: '交通出行' }),
]

describe('queryTransactions 筛选', () => {
  it('按支出筛选，只留 amount > 0', () => {
    const r = queryTransactions(data, { direction: 'expense' })
    expect(r.map((t) => t.id).sort()).toEqual(['a', 'c', 'd'])
  })

  it('按收入筛选，只留 amount < 0', () => {
    const r = queryTransactions(data, { direction: 'income' })
    expect(r.map((t) => t.id)).toEqual(['b'])
  })

  it('按月份筛选', () => {
    const r = queryTransactions(data, { month: '2026-08' })
    expect(r.map((t) => t.id)).toEqual(['d'])
  })

  it('按分类筛选', () => {
    const r = queryTransactions(data, { category: '购物消费' })
    expect(r.map((t) => t.id)).toEqual(['c'])
  })

  it('关键词同时匹配交易对方与商品说明，且忽略大小写', () => {
    expect(queryTransactions(data, { keyword: '京东' }).map((t) => t.id)).toEqual(['c'])
    expect(queryTransactions(data, { keyword: '数码' }).map((t) => t.id)).toEqual(['c'])
    expect(queryTransactions(data, { keyword: '不存在' })).toEqual([])
  })

  it('多个条件可以叠加', () => {
    const r = queryTransactions(data, { direction: 'expense', month: '2026-09' })
    expect(r.map((t) => t.id).sort()).toEqual(['a', 'c'])
  })
})

describe('queryTransactions 排序', () => {
  it('默认按时间倒序', () => {
    expect(queryTransactions(data).map((t) => t.id)).toEqual(['c', 'b', 'a', 'd'])
  })

  it('按时间正序', () => {
    expect(queryTransactions(data, { sort: 'time-asc' }).map((t) => t.id)).toEqual(['d', 'a', 'b', 'c'])
  })

  it('按金额倒序时用绝对值，收入不会被排到最后', () => {
    expect(queryTransactions(data, { sort: 'amount-desc' }).map((t) => t.id)).toEqual(['b', 'c', 'a', 'd'])
  })

  it('按金额正序时用绝对值', () => {
    expect(queryTransactions(data, { sort: 'amount-asc' }).map((t) => t.id)).toEqual(['d', 'a', 'c', 'b'])
  })

  it('排序不修改原数组', () => {
    const before = data.map((t) => t.id)
    queryTransactions(data, { sort: 'amount-asc' })
    expect(data.map((t) => t.id)).toEqual(before)
  })
})

describe('getAvailableMonths', () => {
  it('返回出现过的月份且最新在前', () => {
    expect(getAvailableMonths(data)).toEqual(['2026-09', '2026-08'])
  })

  it('跳过损坏的日期数据', () => {
    const broken = [txn({ id: 'x', transactionTime: 'bad-data' })]
    expect(getAvailableMonths(broken)).toEqual([])
  })
})

describe('summarizeTransactions', () => {
  it('分别汇总笔数、支出与收入', () => {
    expect(summarizeTransactions(data)).toEqual({
      count: 4,
      expense: 150,
      income: 5000,
    })
  })

  it('空列表返回全零', () => {
    expect(summarizeTransactions([])).toEqual({ count: 0, expense: 0, income: 0 })
  })
})
