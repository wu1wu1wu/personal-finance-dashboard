import { describe, it, expect } from 'vitest'
import type { Budget, Transaction } from '@/types'
import {
  TRASH_MAX_BATCHES,
  TRASH_MAX_TRANSACTIONS,
  TRASH_TTL_MS,
  addTrashEntry,
  createTrashEntry,
  pruneTrash,
  restoreBudgets,
  restoreTotalBudgets,
  restoreTransactions,
  trashTransactionCount,
} from './trash'

function txn(id: string, patch: Partial<Transaction> = {}): Transaction {
  return {
    id,
    transactionTime: '2026-09-10 12:00:00',
    transactionType: '支出',
    counterparty: '美团',
    description: '',
    amount: 23,
    paymentStatus: '',
    transactionNo: `NO-${id}`,
    paymentMethod: '',
    category: '餐饮美食',
    categorySource: 'auto',
    origin: 'import',
    isPeriodic: false,
    tags: [],
    createdAt: '2026-09-10T04:00:00.000Z',
    coverImage: '',
    theme: '',
    ...patch,
  }
}

function entry(id: string, deletedAt: string, count: number, reason: 'single' | 'months' = 'single') {
  return createTrashEntry({
    id,
    reason,
    label: id,
    transactions: Array.from({ length: count }, (_, i) => txn(`${id}-${i}`)),
    now: new Date(deletedAt),
  })
}

describe('createTrashEntry', () => {
  it('生成带时间戳与来源的批次', () => {
    const e = createTrashEntry({
      id: 'e1',
      reason: 'single',
      label: '美团',
      transactions: [txn('t1')],
      now: new Date('2026-09-16T10:00:00.000Z'),
    })

    expect(e.id).toBe('e1')
    expect(e.deletedAt).toBe('2026-09-16T10:00:00.000Z')
    expect(e.reason).toBe('single')
    expect(e.transactions).toHaveLength(1)
  })

  it('可以带上被一起删掉的预算', () => {
    const budget: Budget = { category: '餐饮美食', monthlyLimit: 1000, color: '#EF4444', month: '2026-09' }
    const e = createTrashEntry({
      reason: 'months',
      label: '9月',
      transactions: [txn('t1')],
      budgets: [budget],
      totalBudgets: { '2026-09': 3000 },
    })

    expect(e.budgets).toEqual([budget])
    expect(e.totalBudgets).toEqual({ '2026-09': 3000 })
  })
})

describe('addTrashEntry', () => {
  it('新的批次排在最前', () => {
    const first = addTrashEntry([], entry('a', '2026-09-16T10:00:00.000Z', 1), new Date('2026-09-16T10:00:00.000Z'))
    const second = addTrashEntry(
      first.entries,
      entry('b', '2026-09-16T11:00:00.000Z', 1),
      new Date('2026-09-16T11:00:00.000Z'),
    )

    expect(second.entries.map((e) => e.id)).toEqual(['b', 'a'])
  })

  it(`超过 ${TRASH_MAX_BATCHES} 批时淘汰最旧的，并把它交还给调用方清理封面`, () => {
    let entries = addTrashEntry([], entry('oldest', '2026-09-16T00:00:00.000Z', 1)).entries
    for (let i = 1; i < TRASH_MAX_BATCHES; i++) {
      const at = `2026-09-16T${String(i).padStart(2, '0')}:00:00.000Z`
      entries = addTrashEntry(entries, entry(`e${i}`, at, 1), new Date(at)).entries
    }

    const result = addTrashEntry(
      entries,
      entry('newest', '2026-09-16T23:00:00.000Z', 1),
      new Date('2026-09-16T23:00:00.000Z'),
    )

    expect(result.entries).toHaveLength(TRASH_MAX_BATCHES)
    expect(result.entries[0].id).toBe('newest')
    expect(result.dropped.map((e) => e.id)).toEqual(['oldest'])
  })
})

describe('pruneTrash', () => {
  const now = new Date('2026-09-16T12:00:00.000Z')

  it('丢掉超过 30 天的批次', () => {
    const old = entry('old', new Date(now.getTime() - TRASH_TTL_MS - 1000).toISOString(), 1)
    const fresh = entry('fresh', new Date(now.getTime() - 1000).toISOString(), 1)

    const result = pruneTrash([fresh, old], now)

    expect(result.entries.map((e) => e.id)).toEqual(['fresh'])
    expect(result.dropped.map((e) => e.id)).toEqual(['old'])
  })

  it(`总笔数超过 ${TRASH_MAX_TRANSACTIONS} 时，从最旧的批次开始丢`, () => {
    const big = entry('big', '2026-09-16T11:00:00.000Z', 400)
    const mid = entry('mid', '2026-09-16T10:00:00.000Z', 100)
    const old = entry('old', '2026-09-16T09:00:00.000Z', 100)

    const result = pruneTrash([big, mid, old], now)

    expect(trashTransactionCount(result.entries)).toBeLessThanOrEqual(TRASH_MAX_TRANSACTIONS)
    expect(result.entries.map((e) => e.id)).toEqual(['big', 'mid'])
    expect(result.dropped.map((e) => e.id)).toEqual(['old'])
  })

  it('单个批次就超上限时保留但截断，而不是整批丢掉', () => {
    const huge = entry('huge', '2026-09-16T11:00:00.000Z', TRASH_MAX_TRANSACTIONS + 50)

    const result = pruneTrash([huge], now)

    expect(result.entries).toHaveLength(1)
    expect(result.entries[0].transactions).toHaveLength(TRASH_MAX_TRANSACTIONS)
  })

  it('没有需要清理的内容时原样返回', () => {
    const fresh = entry('fresh', '2026-09-16T11:00:00.000Z', 2)

    const result = pruneTrash([fresh], now)

    expect(result.entries).toEqual([fresh])
    expect(result.dropped).toEqual([])
  })
})

describe('恢复', () => {
  it('按 id 合并交易，已存在的跳过（不覆盖用户后续的改动）', () => {
    const e = entry('e1', '2026-09-16T10:00:00.000Z', 2)
    const existing = [txn('e1-1', { amount: 999, category: '购物消费' })]

    const merged = restoreTransactions(e, existing)

    expect(merged).toHaveLength(2)
    expect(merged.find((t) => t.id === 'e1-1')?.amount).toBe(999)
    expect(merged.map((t) => t.id).sort()).toEqual(['e1-0', 'e1-1'])
  })

  it('恢复交易排在前面，用户一眼能看到', () => {
    const e = entry('e1', '2026-09-16T10:00:00.000Z', 1)
    const existing = [txn('keep')]

    expect(restoreTransactions(e, existing)[0].id).toBe('e1-0')
  })

  it('预算按 分类+月份 去重', () => {
    const budget: Budget = { category: '餐饮美食', monthlyLimit: 1000, color: '#EF4444', month: '2026-09' }
    const e = createTrashEntry({
      reason: 'months',
      label: '9月',
      transactions: [],
      budgets: [budget],
    })

    expect(restoreBudgets(e, [{ ...budget, monthlyLimit: 500 }])).toHaveLength(1)
    expect(restoreBudgets(e, [])).toHaveLength(1)
  })

  it('总预算只补回缺失的月份，不覆盖现有设置', () => {
    const e = createTrashEntry({
      reason: 'months',
      label: '9月',
      transactions: [],
      totalBudgets: { '2026-09': 3000, '2026-08': 2000 },
    })

    const merged = restoreTotalBudgets(e, { '2026-09': 999 })

    expect(merged).toEqual({ '2026-09': 999, '2026-08': 2000 })
  })
})
