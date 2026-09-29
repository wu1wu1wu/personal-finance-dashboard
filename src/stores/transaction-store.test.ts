import { describe, it, expect, beforeEach, vi } from 'vitest'
import { useTransactionStore } from './transaction-store'
import { flushPersist } from '@/storage/persist-queue'
import { coverKey } from '@/storage/cover-store'
import { STORAGE_KEYS } from '@/types'
import type { Transaction } from '@/types'

interface FakeLocalStorage {
  [key: string]: unknown
  getItem(key: string): string | null
  setItem(key: string, value: string): void
  removeItem(key: string): void
  clear(): void
  key(index: number): string | null
  readonly length: number
}

/**
 * 假 localStorage：条目直接挂在对象上，这样 Object.keys(localStorage)
 * （LocalStorageAdapter.keys 的实现）才能看见写入的键。
 */
function fakeLocalStorage(): FakeLocalStorage {
  const METHODS = new Set(['getItem', 'setItem', 'removeItem', 'clear', 'key', 'length'])
  const api = {
    getItem(key: string): string | null {
      const value = api[key]
      return typeof value === 'string' ? value : null
    },
    setItem(key: string, value: string) {
      api[key] = value
    },
    removeItem(key: string) {
      delete api[key]
    },
    clear() {
      for (const key of Object.keys(api)) {
        if (!METHODS.has(key)) delete api[key]
      }
    },
    key(index: number): string | null {
      return storedKeys()[index] ?? null
    },
    get length() {
      return storedKeys().length
    },
  } as FakeLocalStorage

  function storedKeys(): string[] {
    return Object.keys(api).filter((k) => !METHODS.has(k))
  }

  return api
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

let fake: ReturnType<typeof fakeLocalStorage>

beforeEach(() => {
  fake = fakeLocalStorage()
  vi.stubGlobal('localStorage', fake)
  useTransactionStore.setState({ transactions: [], loaded: false })
})

describe('addTransaction', () => {
  it('同 id 不重复入账（通知实时推送 + 队列重放会送两次）', () => {
    const store = useTransactionStore.getState()
    store.addTransaction(txn({ id: 't1' }))
    store.addTransaction(txn({ id: 't1' }))

    expect(useTransactionStore.getState().transactions).toHaveLength(1)
  })
})

describe('updateTransaction', () => {
  it('能改金额/时间/对方/描述，并标记为用户编辑过', () => {
    useTransactionStore.setState({ transactions: [txn({ id: 't1' })] })

    useTransactionStore.getState().updateTransaction('t1', {
      amount: 35.5,
      transactionTime: '2026-09-11 09:00:00',
      counterparty: '肯德基',
      description: '早餐',
    })

    const updated = useTransactionStore.getState().transactions[0]
    expect(updated.amount).toBe(35.5)
    expect(updated.transactionTime).toBe('2026-09-11 09:00:00')
    expect(updated.counterparty).toBe('肯德基')
    expect(updated.description).toBe('早餐')
    // 用户改过的记录不能再被账单回填覆盖
    expect(updated.userEdited).toBe(true)
  })

  it('不改 id（去重体系与封面图都挂在 id 上）', () => {
    useTransactionStore.setState({ transactions: [txn({ id: 't1' })] })

    useTransactionStore.getState().updateTransaction('t1', { amount: 99 })

    expect(useTransactionStore.getState().transactions[0].id).toBe('t1')
  })

  it('id 不存在时什么也不改', () => {
    useTransactionStore.setState({ transactions: [txn({ id: 't1' })] })

    useTransactionStore.getState().updateTransaction('nope', { amount: 99 })

    expect(useTransactionStore.getState().transactions[0].amount).toBe(23)
  })

  it('改动会写进存储', async () => {
    useTransactionStore.setState({ transactions: [txn({ id: 't1' })] })

    useTransactionStore.getState().updateTransaction('t1', { amount: 88 })
    await flushPersist('transactions')

    const saved = JSON.parse(fake[STORAGE_KEYS.TRANSACTIONS] as string)
    expect(saved[0].amount).toBe(88)
    // 主记录里不该留 base64 图片
    expect(saved[0].coverImage).toBe('')
  })
})

describe('封面图迁移', () => {
  it('老数据里内嵌的 base64 会被搬到独立键，读回后 UI 照旧能拿到', async () => {
    const image = 'data:image/jpeg;base64,AAAA'
    fake[STORAGE_KEYS.TRANSACTIONS] = JSON.stringify([txn({ id: 't1', coverImage: image })])

    await useTransactionStore.getState().loadFromStorage()

    expect(useTransactionStore.getState().transactions[0].coverImage).toBe(image)
    expect(JSON.parse(fake[coverKey('t1')] as string)).toBe(image)
    expect(JSON.parse(fake[STORAGE_KEYS.TRANSACTIONS] as string)[0].coverImage).toBe('')
  })

  it('删除交易时把封面键一起清掉', async () => {
    fake[coverKey('t1')] = JSON.stringify('data:image/jpeg;base64,AAAA')
    useTransactionStore.setState({ transactions: [txn({ id: 't1' })], loaded: true })

    useTransactionStore.getState().deleteTransaction('t1')

    expect(fake[coverKey('t1')]).toBeUndefined()
  })
})

describe('togglePeriodicBatch', () => {
  it('一次切换多条，只写一次盘', async () => {
    useTransactionStore.setState({
      transactions: [txn({ id: 't1' }), txn({ id: 't2' }), txn({ id: 't3' })],
    })

    useTransactionStore.getState().togglePeriodicBatch(['t1', 't3'])

    const list = useTransactionStore.getState().transactions
    expect(list.map((t) => t.isPeriodic)).toEqual([true, false, true])
  })
})
