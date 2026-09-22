import { describe, it, expect } from 'vitest'
import type { Transaction } from '@/types'
import { reconcileImportedBills, isPlaceholder, MATCH_WINDOW_MS } from './transaction-reconcile'

function txn(partial: Partial<Transaction> & Pick<Transaction, 'id'>): Transaction {
  return {
    transactionTime: '2026-09-10 12:00:00',
    transactionType: '支出',
    counterparty: '',
    description: '',
    amount: 23,
    paymentStatus: '',
    transactionNo: '',
    paymentMethod: '',
    category: '待确认',
    categorySource: 'auto',
    origin: 'auto',
    isPeriodic: false,
    tags: [],
    createdAt: '2026-09-10T04:00:00.000Z',
    coverImage: '',
    theme: '',
    ...partial,
  }
}

/** 自动捕获的占位记录 */
function placeholder(id: string, time: string, amount: number): Transaction {
  return txn({
    id,
    transactionTime: time,
    amount,
    transactionNo: `auto-${time}`,
    counterparty: '',
    description: '微信支付 已支付',
    origin: 'auto',
    category: '待确认',
  })
}

/** 账单导入的记录（带真实商户） */
function bill(id: string, time: string, amount: number, merchant: string, description = ''): Transaction {
  return txn({
    id,
    transactionTime: time,
    amount,
    transactionNo: `42000${id}`,
    counterparty: merchant,
    description,
    origin: 'import',
  })
}

describe('isPlaceholder', () => {
  it('自动捕获且未手动分类的记录是占位', () => {
    expect(isPlaceholder(placeholder('p1', '2026-09-10 12:00:00', 23))).toBe(true)
  })

  it('手动指定分类的自动记录不算占位', () => {
    const t = { ...placeholder('p1', '2026-09-10 12:00:00', 23), categorySource: 'manual' as const }
    expect(isPlaceholder(t)).toBe(false)
  })

  it('账单导入的记录不算占位', () => {
    expect(isPlaceholder(bill('b1', '2026-09-10 12:00:00', 23, '美团'))).toBe(false)
  })
})

describe('reconcileImportedBills 基本回填', () => {
  it('金额与时间接近时，用账单补全占位记录', () => {
    const existing = [placeholder('p1', '2026-09-10 12:00:30', 23)]
    const imported = [bill('b1', '2026-09-10 12:00:00', 23, '肯德基', '餐饮')]

    const r = reconcileImportedBills(existing, imported)

    expect(r.stats).toEqual({ enrichedCount: 1, addedCount: 0 })
    expect(r.transactions).toHaveLength(1)
    const enriched = r.transactions[0]
    expect(enriched.id).toBe('p1')            // id 保留，封面/标签不丢
    expect(enriched.counterparty).toBe('肯德基')
    expect(enriched.description).toBe('餐饮')
    expect(enriched.transactionNo).toBe('42000b1')
    expect(enriched.origin).toBe('import')
    expect(enriched.categorySource).toBe('auto')
  })

  it('回填后按真实商户重新分类', () => {
    const existing = [placeholder('p1', '2026-09-10 12:00:00', 23)]
    const imported = [bill('b1', '2026-09-10 12:00:00', 23, '美团外卖')]

    const r = reconcileImportedBills(existing, imported)

    expect(r.transactions[0].category).toBe('餐饮美食')
  })

  it('跨月导入也能匹配（窗口 24 小时，与导出频率无关）', () => {
    const existing = [placeholder('p1', '2026-08-03 19:20:00', 88)]
    const imported = [bill('b1', '2026-08-03 19:20:05', 88, '京东')]

    const r = reconcileImportedBills(existing, imported)

    expect(r.stats.enrichedCount).toBe(1)
    expect(r.transactions).toHaveLength(1)
  })

  it('保留占位记录上的封面图与标签', () => {
    const existing = [
      { ...placeholder('p1', '2026-09-10 12:00:00', 23), coverImage: 'data:image/png;base64,xx', tags: ['报销'] },
    ]
    const imported = [bill('b1', '2026-09-10 12:00:00', 23, '肯德基')]

    const r = reconcileImportedBills(existing, imported)

    expect(r.transactions[0].coverImage).toBe('data:image/png;base64,xx')
    expect(r.transactions[0].tags).toEqual(['报销'])
  })
})

describe('reconcileImportedBills 不应匹配的情况', () => {
  it('金额不同不匹配，账单按新记录加入', () => {
    const existing = [placeholder('p1', '2026-09-10 12:00:00', 23)]
    const imported = [bill('b1', '2026-09-10 12:00:00', 24, '肯德基')]

    const r = reconcileImportedBills(existing, imported)

    expect(r.stats).toEqual({ enrichedCount: 0, addedCount: 1 })
    expect(r.transactions).toHaveLength(2)
    expect(r.transactions[0].counterparty).toBe('')
  })

  it('收支方向不同不匹配', () => {
    const existing = [placeholder('p1', '2026-09-10 12:00:00', 50)]
    const imported = [bill('b1', '2026-09-10 12:00:00', -50, '张三')]

    const r = reconcileImportedBills(existing, imported)

    expect(r.stats).toEqual({ enrichedCount: 0, addedCount: 1 })
  })

  it('超出时间窗口不匹配', () => {
    const existing = [placeholder('p1', '2026-09-10 12:00:00', 23)]
    const imported = [bill('b1', '2026-09-12 12:00:01', 23, '肯德基')]

    const r = reconcileImportedBills(existing, imported)

    expect(r.stats).toEqual({ enrichedCount: 0, addedCount: 1 })
  })

  it('用户手动改过分类的占位不被覆盖', () => {
    const manual = {
      ...placeholder('p1', '2026-09-10 12:00:00', 23),
      category: '医疗健康',
      categorySource: 'manual' as const,
    }
    const imported = [bill('b1', '2026-09-10 12:00:00', 23, '肯德基')]

    const r = reconcileImportedBills([manual], imported)

    expect(r.stats).toEqual({ enrichedCount: 0, addedCount: 1 })
    expect(r.transactions[0].category).toBe('医疗健康')
    expect(r.transactions[0].counterparty).toBe('')
  })

  it('时间解析失败的记录不参与匹配', () => {
    const broken = { ...placeholder('p1', '2026-09-10 12:00:00', 23), transactionTime: 'bad' }
    const imported = [bill('b1', '2026-09-10 12:00:00', 23, '肯德基')]

    const r = reconcileImportedBills([broken], imported)

    expect(r.stats).toEqual({ enrichedCount: 0, addedCount: 1 })
  })
})

describe('reconcileImportedBills 同金额多笔', () => {
  it('按时间就近一对一配对，不串号', () => {
    const existing = [
      placeholder('p1', '2026-09-10 08:00:00', 23),
      placeholder('p2', '2026-09-10 20:00:00', 23),
    ]
    const imported = [
      bill('b1', '2026-09-10 20:00:10', 23, '夜宵店'),
      bill('b2', '2026-09-10 08:00:10', 23, '早餐店'),
    ]

    const r = reconcileImportedBills(existing, imported)

    expect(r.stats).toEqual({ enrichedCount: 2, addedCount: 0 })
    const byId = new Map(r.transactions.map((t) => [t.id, t]))
    expect(byId.get('p1')?.counterparty).toBe('早餐店')
    expect(byId.get('p2')?.counterparty).toBe('夜宵店')
  })

  it('占位少于账单时，多出来的按新记录加入', () => {
    const existing = [placeholder('p1', '2026-09-10 08:00:00', 23)]
    const imported = [
      bill('b1', '2026-09-10 08:00:10', 23, '早餐店'),
      bill('b2', '2026-09-10 20:00:10', 23, '夜宵店'),
    ]

    const r = reconcileImportedBills(existing, imported)

    expect(r.stats).toEqual({ enrichedCount: 1, addedCount: 1 })
    expect(r.transactions).toHaveLength(2)
  })

  it('金额按分比较，浮点尾数不影响匹配', () => {
    const existing = [placeholder('p1', '2026-09-10 12:00:00', 0.1 + 0.2)]
    const imported = [bill('b1', '2026-09-10 12:00:00', 0.3, '便利店')]

    const r = reconcileImportedBills(existing, imported)

    expect(r.stats.enrichedCount).toBe(1)
  })
})

describe('MATCH_WINDOW_MS', () => {
  it('窗口是 24 小时', () => {
    expect(MATCH_WINDOW_MS).toBe(24 * 60 * 60 * 1000)
  })
})
