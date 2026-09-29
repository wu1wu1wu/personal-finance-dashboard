import { describe, it, expect } from 'vitest'
import {
  BACKUP_VERSION,
  validateBackup,
  restoreBackup,
  buildBackup,
  snapshotCurrent,
  SNAPSHOT_PREFIX,
  MAX_SNAPSHOTS,
  type BackupStorage,
} from './backup'

function fakeStorage(initial: Record<string, unknown> = {}) {
  const map = new Map<string, unknown>(Object.entries(initial))
  let failOn: string | null = null
  return {
    dump: map,
    failNextWriteOn(key: string) {
      failOn = key
    },
    get: async <T,>(key: string) => (map.has(key) ? (map.get(key) as T) : null),
    set: async <T,>(key: string, value: T) => {
      if (failOn === key) {
        failOn = null
        throw new Error('存储空间不足')
      }
      map.set(key, value)
    },
    remove: async (key: string) => void map.delete(key),
    keys: async () => [...map.keys()],
  } satisfies BackupStorage & { dump: Map<string, unknown>; failNextWriteOn: (k: string) => void }
}

function backup(keys: string[], extra: Record<string, unknown> = {}) {
  return {
    _meta: { version: BACKUP_VERSION, exportTime: '2026-09-16T00:00:00.000Z', keys },
    ...extra,
  }
}

describe('validateBackup', () => {
  it('接受结构正确的备份', () => {
    const file = backup(['pfd_transactions', 'pfd_budgets'], {
      pfd_transactions: [],
      pfd_budgets: [],
    })

    expect(validateBackup(file).ok).toBe(true)
  })

  it('没有 _meta 直接拒绝', () => {
    const result = validateBackup({ pfd_transactions: [] })

    expect(result.ok).toBe(false)
  })

  it('版本不认识时拒绝', () => {
    const result = validateBackup({
      _meta: { version: '2.0', keys: [] },
    })

    expect(result.ok).toBe(false)
  })

  it('keys 不是数组时拒绝', () => {
    const result = validateBackup({ _meta: { version: BACKUP_VERSION, keys: 'nope' } })

    expect(result.ok).toBe(false)
  })

  it('交易字段不是数组时拒绝（否则启动后会在 substring 上崩掉）', () => {
    const result = validateBackup(
      backup(['pfd_transactions'], { pfd_transactions: { nope: true } }),
    )

    expect(result.ok).toBe(false)
  })

  it('非 pfd_ 前缀的键会被剔掉，不写进本机存储', () => {
    const result = validateBackup(
      backup(['pfd_transactions', 'evil_key'], { pfd_transactions: [], evil_key: 'x' }),
    )

    expect(result.ok).toBe(true)
    if (result.ok) expect(result.keys).toEqual(['pfd_transactions'])
  })

  it('缺失的键会被跳过', () => {
    const result = validateBackup(backup(['pfd_transactions', 'pfd_budgets'], { pfd_transactions: [] }))

    expect(result.ok).toBe(true)
    if (result.ok) expect(result.keys).toEqual(['pfd_transactions'])
  })
})

describe('restoreBackup', () => {
  it('逐键写回并报告成功数量', async () => {
    const store = fakeStorage({ pfd_transactions: [{ id: 'old' }] })
    const file = backup(['pfd_transactions', 'pfd_budgets'], {
      pfd_transactions: [{ id: 'new' }],
      pfd_budgets: [{ category: '餐饮美食' }],
    })

    const result = await restoreBackup(file, store)

    expect(result.ok).toBe(true)
    expect(store.dump.get('pfd_transactions')).toEqual([{ id: 'new' }])
    expect(store.dump.get('pfd_budgets')).toEqual([{ category: '餐饮美食' }])
  })

  it('中途写入失败要回滚已经写过的键', async () => {
    const store = fakeStorage({
      pfd_transactions: [{ id: 'old' }],
      pfd_budgets: [{ category: '旧预算' }],
    })
    const file = backup(['pfd_transactions', 'pfd_budgets'], {
      pfd_transactions: [{ id: 'new' }],
      pfd_budgets: [{ category: '新预算' }],
    })
    store.failNextWriteOn('pfd_budgets')

    const result = await restoreBackup(file, store)

    expect(result.ok).toBe(false)
    // 已经被覆盖的交易必须还原回去，避免"一半新一半旧"
    expect(store.dump.get('pfd_transactions')).toEqual([{ id: 'old' }])
    expect(store.dump.get('pfd_budgets')).toEqual([{ category: '旧预算' }])
  })

  it('本机原本没有的键，回滚时要删掉', async () => {
    const store = fakeStorage()
    const file = backup(['pfd_transactions'], { pfd_transactions: [{ id: 'new' }] })

    const result = await restoreBackup(file, store)

    expect(result.ok).toBe(true)
    expect(store.dump.get('pfd_transactions')).toEqual([{ id: 'new' }])
  })

  it('结构不合法的备份不写任何键', async () => {
    const store = fakeStorage({ pfd_transactions: [{ id: 'old' }] })

    const result = await restoreBackup({ _meta: { version: '2.0', keys: [] } }, store)

    expect(result.ok).toBe(false)
    expect(store.dump.get('pfd_transactions')).toEqual([{ id: 'old' }])
  })
})

describe('buildBackup', () => {
  it('导出所有 pfd_ 前缀的键，并写入元信息', async () => {
    const store = fakeStorage({
      pfd_transactions: [{ id: 't1' }],
      pfd_budgets: [],
      other_app_key: '不该被带上',
    })

    const file = await buildBackup(store)

    expect(file._meta.version).toBe(BACKUP_VERSION)
    expect(Object.keys(file).sort()).toEqual(['_meta', 'pfd_budgets', 'pfd_transactions'])
  })

  it('没有交易也能导出（只备份规则和预算）', async () => {
    const store = fakeStorage({ pfd_custom_rules: [{ id: 'r1' }] })

    const file = await buildBackup(store)

    expect(file._meta.keys).toEqual(['pfd_custom_rules'])
  })

  it('不带上历史快照，否则备份文件会自我膨胀', async () => {
    const store = fakeStorage({
      pfd_transactions: [],
      [`${SNAPSHOT_PREFIX}2026-09-01T00:00:00.000Z`]: { pfd_transactions: [] },
    })

    const file = await buildBackup(store)

    expect(file._meta.keys).toEqual(['pfd_transactions'])
  })
})

describe('snapshotCurrent', () => {
  it('把当前数据存成快照，并只保留最近几份', async () => {
    const store = fakeStorage({ pfd_transactions: [{ id: 't1' }] })

    // 已经有 3 份快照时，再存一份要把最旧的挤掉
    for (let i = 0; i < MAX_SNAPSHOTS; i++) {
      store.dump.set(`${SNAPSHOT_PREFIX}2026-09-0${i + 1}T00:00:00.000Z`, { pfd_transactions: [] })
    }

    await snapshotCurrent(store, '2026-09-10T00:00:00.000Z')

    const snapshots = [...store.dump.keys()].filter((k) => k.startsWith(SNAPSHOT_PREFIX))
    expect(snapshots).toHaveLength(MAX_SNAPSHOTS)
    expect(snapshots).toContain(`${SNAPSHOT_PREFIX}2026-09-10T00:00:00.000Z`)
    expect(snapshots).not.toContain(`${SNAPSHOT_PREFIX}2026-09-01T00:00:00.000Z`)
  })

  it('快照内容就是当前全部数据', async () => {
    const store = fakeStorage({ pfd_transactions: [{ id: 't1' }], pfd_budgets: [] })

    await snapshotCurrent(store, '2026-09-10T00:00:00.000Z')

    const snap = store.dump.get(`${SNAPSHOT_PREFIX}2026-09-10T00:00:00.000Z`)
    expect(snap).toMatchObject({ pfd_transactions: [{ id: 't1' }] })
  })
})
