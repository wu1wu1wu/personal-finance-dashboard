import { describe, it, expect } from 'vitest'
import type { StorageAdapter } from './StorageAdapter'
import { coverKey, migrateInlineCovers, hydrateCovers } from './cover-store'
import type { Transaction } from '@/types'

function fakeStorage(initial: Record<string, unknown> = {}): StorageAdapter & { dump: Map<string, unknown> } {
  const map = new Map<string, unknown>(Object.entries(initial))
  return {
    dump: map,
    get: async <T,>(key: string) => (map.has(key) ? (map.get(key) as T) : null),
    set: async <T,>(key: string, value: T) => void map.set(key, value),
    remove: async (key: string) => void map.delete(key),
    clear: async () => map.clear(),
    keys: async () => [...map.keys()],
  }
}

function txn(partial: Partial<Transaction> & Pick<Transaction, 'id'>): Transaction {
  return {
    transactionTime: '2026-09-10 12:00:00',
    transactionType: '支出',
    counterparty: '美团',
    description: '',
    amount: 23,
    paymentStatus: '',
    transactionNo: 'NO1',
    paymentMethod: '',
    category: '餐饮美食',
    categorySource: 'auto',
    origin: 'import',
    isPeriodic: false,
    tags: [],
    createdAt: '2026-09-10T04:00:00.000Z',
    coverImage: '',
    theme: '',
    ...partial,
  }
}

describe('封面图独立存储', () => {
  it('把内嵌的 base64 图片挪到独立键，主记录里只留空串', async () => {
    const store = fakeStorage()
    const image = 'data:image/jpeg;base64,AAAA'
    const list = [txn({ id: 't1', coverImage: image })]

    const migrated = await migrateInlineCovers(list, store)

    expect(migrated[0].coverImage).toBe('')
    expect(store.dump.get(coverKey('t1'))).toBe(image)
  })

  it('读取时再把图片合并回来（UI 完全不用改）', async () => {
    const store = fakeStorage({ [coverKey('t1')]: 'data:image/jpeg;base64,AAAA' })
    const list = [txn({ id: 't1' })]

    const hydrated = await hydrateCovers(list, store)

    expect(hydrated[0].coverImage).toBe('data:image/jpeg;base64,AAAA')
  })

  it('迁移后再读取能拿回原图（往返一致）', async () => {
    const store = fakeStorage()
    const image = 'data:image/jpeg;base64,BBBB'

    const migrated = await migrateInlineCovers([txn({ id: 't1', coverImage: image })], store)
    const hydrated = await hydrateCovers(migrated, store)

    expect(hydrated[0].coverImage).toBe(image)
  })

  it('没有封面的记录不动，也不产生多余键', async () => {
    const store = fakeStorage()
    const list = [txn({ id: 't1' }), txn({ id: 't2' })]

    const migrated = await migrateInlineCovers(list, store)

    expect(migrated.map((t) => t.coverImage)).toEqual(['', ''])
    expect(store.dump.size).toBe(0)
  })

  it('已经迁移过的记录不会重复写入（幂等）', async () => {
    const store = fakeStorage({ [coverKey('t1')]: 'data:image/jpeg;base64,AAAA' })
    const list = [txn({ id: 't1' })]

    await migrateInlineCovers(list, store)

    expect(store.dump.size).toBe(1)
  })
})
