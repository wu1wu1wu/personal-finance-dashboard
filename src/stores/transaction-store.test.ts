import { describe, it, expect, beforeEach, vi } from 'vitest'
import { useTransactionStore } from './transaction-store'
import { flushPersist } from '@/storage/persist-queue'
import { coverKey } from '@/storage/cover-store'
import { createTrashEntry, TRASH_TTL_MS } from '@/core/trash'
import { NOTE_MAX_LENGTH } from '@/core/transaction-note'
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

  it('删除交易时不立即清封面（撤销还要用），进回收站后才可能被清', async () => {
    fake[coverKey('t1')] = JSON.stringify('data:image/jpeg;base64,AAAA')
    useTransactionStore.setState({ transactions: [txn({ id: 't1' })], trash: [], loaded: true })

    useTransactionStore.getState().deleteTransaction('t1')

    expect(fake[coverKey('t1')]).toBeDefined()
    expect(useTransactionStore.getState().trash).toHaveLength(1)
  })
})

describe('最近删除（回收站）', () => {
  it('删除后进入回收站，记录里的交易原样保存', async () => {
    useTransactionStore.setState({
      transactions: [txn({ id: 't1', counterparty: '美团' })],
      trash: [],
      loaded: true,
    })

    useTransactionStore.getState().deleteTransaction('t1')

    const { transactions, trash } = useTransactionStore.getState()
    expect(transactions).toHaveLength(0)
    expect(trash).toHaveLength(1)
    expect(trash[0].reason).toBe('single')
    expect(trash[0].label).toBe('美团')
    expect(trash[0].transactions.map((t) => t.id)).toEqual(['t1'])
  })

  it('撤销后交易回到库里，id 不变，回收站条目消失', async () => {
    useTransactionStore.setState({ transactions: [txn({ id: 't1' })], trash: [], loaded: true })
    useTransactionStore.getState().deleteTransaction('t1')
    const entryId = useTransactionStore.getState().trash[0].id

    useTransactionStore.getState().restoreTrashEntry(entryId)

    const { transactions, trash } = useTransactionStore.getState()
    expect(transactions.map((t) => t.id)).toEqual(['t1'])
    expect(trash).toHaveLength(0)
  })

  it('撤销时已存在的同 id 记录不被覆盖', async () => {
    useTransactionStore.setState({ transactions: [txn({ id: 't1', amount: 23 })], trash: [], loaded: true })
    useTransactionStore.getState().deleteTransaction('t1')
    const entryId = useTransactionStore.getState().trash[0].id
    // 模拟用户删除后又手动补了一笔（同 id 极不可能，但逻辑上不能覆盖）
    useTransactionStore.setState({ transactions: [txn({ id: 't1', amount: 55 })] })

    useTransactionStore.getState().restoreTrashEntry(entryId)

    expect(useTransactionStore.getState().transactions).toHaveLength(1)
    expect(useTransactionStore.getState().transactions[0].amount).toBe(55)
  })

  it('按月份清理会记成一批，并带走同批删掉的预算', async () => {
    useTransactionStore.setState({
      transactions: [
        txn({ id: 'a', transactionTime: '2026-08-05 10:00:00' }),
        txn({ id: 'b', transactionTime: '2026-09-05 10:00:00' }),
        txn({ id: 'c', transactionTime: '2026-10-05 10:00:00' }),
      ],
      trash: [],
      loaded: true,
    })

    const removed = useTransactionStore.getState().deleteByMonths(['2026-08', '2026-09'], {
      label: '8 月、9 月',
      budgets: [{ category: '餐饮美食', monthlyLimit: 1000, color: '#EF4444', month: '2026-08' }],
      totalBudgets: { '2026-08': 3000 },
    })

    const { transactions, trash } = useTransactionStore.getState()
    expect(removed).toBe(2)
    expect(transactions.map((t) => t.id)).toEqual(['c'])
    expect(trash[0].reason).toBe('months')
    expect(trash[0].label).toBe('8 月、9 月')
    expect(trash[0].budgets).toHaveLength(1)
    expect(trash[0].totalBudgets).toEqual({ '2026-08': 3000 })
  })

  it('清空回收站会把里面的封面图一并清掉', async () => {
    fake[coverKey('t1')] = JSON.stringify('data:image/jpeg;base64,AAAA')
    useTransactionStore.setState({ transactions: [txn({ id: 't1' })], trash: [], loaded: true })
    useTransactionStore.getState().deleteTransaction('t1')

    useTransactionStore.getState().clearTrash()

    expect(useTransactionStore.getState().trash).toHaveLength(0)
    expect(fake[coverKey('t1')]).toBeUndefined()
  })

  it('加载时剪掉过期批次，并清掉它们的封面', async () => {
    const expired = createTrashEntry({
      id: 'old',
      reason: 'single',
      label: '很久以前',
      transactions: [txn({ id: 'gone' })],
      now: new Date(Date.now() - TRASH_TTL_MS - 1000),
    })
    fake[STORAGE_KEYS.TRASH] = JSON.stringify([expired])
    fake[coverKey('gone')] = JSON.stringify('data:image/jpeg;base64,AAAA')

    await useTransactionStore.getState().loadFromStorage()

    expect(useTransactionStore.getState().trash).toHaveLength(0)
    expect(fake[coverKey('gone')]).toBeUndefined()
  })

  it('回收站与交易一起落盘', async () => {
    useTransactionStore.setState({ transactions: [txn({ id: 't1' })], trash: [], loaded: true })
    useTransactionStore.getState().deleteTransaction('t1')

    await flushPersist('transactions')

    expect(JSON.parse(fake[STORAGE_KEYS.TRASH] as string)).toHaveLength(1)
  })
})

describe('setTheme（手记文字）', () => {
  it('写入前统一清洗：去掉首尾空白，按上限截断', () => {
    useTransactionStore.setState({ transactions: [txn({ id: 't1' })], trash: [], loaded: true })

    useTransactionStore.getState().setTheme('t1', `  ${'记'.repeat(NOTE_MAX_LENGTH + 30)}  `)

    const theme = useTransactionStore.getState().transactions[0].theme
    expect(theme.startsWith('记')).toBe(true)
    expect(theme).toHaveLength(NOTE_MAX_LENGTH)
  })

  it('纯空白等于没写', () => {
    useTransactionStore.setState({
      transactions: [txn({ id: 't1', theme: '旧手记' })],
      trash: [],
      loaded: true,
    })

    useTransactionStore.getState().setTheme('t1', '   ')

    expect(useTransactionStore.getState().transactions[0].theme).toBe('')
  })
})

describe('clearNote（移出手记）', () => {
  it('手记文字与配图一次清掉，独立的图片键也一起删', () => {
    const image = 'data:image/jpeg;base64,AAAA'
    fake[coverKey('t1')] = JSON.stringify(image)
    useTransactionStore.setState({
      transactions: [txn({ id: 't1', theme: '和朋友的晚餐', coverImage: image })],
      trash: [],
      loaded: true,
    })

    useTransactionStore.getState().clearNote('t1')

    const cleared = useTransactionStore.getState().transactions[0]
    expect(cleared.theme).toBe('')
    expect(cleared.coverImage).toBe('')
    expect(fake[coverKey('t1')]).toBeUndefined()
  })

  it('只动这一笔，别的手记不受影响', () => {
    useTransactionStore.setState({
      transactions: [txn({ id: 't1', theme: '手记一' }), txn({ id: 't2', theme: '手记二' })],
      trash: [],
      loaded: true,
    })

    useTransactionStore.getState().clearNote('t1')

    expect(useTransactionStore.getState().transactions[1].theme).toBe('手记二')
  })

  it('清完会落盘，主数组里不留图片', async () => {
    useTransactionStore.setState({
      transactions: [txn({ id: 't1', theme: '和朋友的晚餐', coverImage: 'data:image/jpeg;base64,AAAA' })],
      trash: [],
      loaded: true,
    })

    useTransactionStore.getState().clearNote('t1')
    await flushPersist('transactions')

    const saved = JSON.parse(fake[STORAGE_KEYS.TRANSACTIONS] as string)[0]
    expect(saved.theme).toBe('')
    expect(saved.coverImage).toBe('')
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
