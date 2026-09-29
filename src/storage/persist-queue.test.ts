import { describe, it, expect, beforeEach, vi } from 'vitest'
import {
  queuePersist,
  flushPersist,
  flushAllPersists,
  usePersistStatus,
} from './persist-queue'

describe('persist-queue', () => {
  beforeEach(() => {
    usePersistStatus.getState().clearError()
    vi.useRealTimers()
  })

  it('写入失败时把原因暴露出来（用户必须能看到"没保存"）', async () => {
    queuePersist('pfd_transactions', async () => {
      throw new Error('存储空间不足，请清理数据或导出备份')
    })

    await flushPersist('pfd_transactions')

    expect(usePersistStatus.getState().error).toBe('存储空间不足，请清理数据或导出备份')
  })

  it('失败后再次写入成功要清掉错误提示', async () => {
    queuePersist('a', async () => {
      throw new Error('写失败')
    })
    await flushPersist('a')
    expect(usePersistStatus.getState().error).toBe('写失败')

    queuePersist('a', async () => undefined)
    await flushPersist('a')

    expect(usePersistStatus.getState().error).toBeNull()
  })

  it('同一份数据的多次改动合并成一次写入', async () => {
    const written: number[] = []
    const write = (n: number) => {
      written.push(n)
    }

    queuePersist('pfd_transactions', async () => write(1))
    queuePersist('pfd_transactions', async () => write(2))
    queuePersist('pfd_transactions', async () => write(3))

    await flushPersist('pfd_transactions')

    // 只写最后一次的快照，前面的被合并掉
    expect(written).toEqual([3])
  })

  it('flushAllPersists 会写掉所有待写入的键', async () => {
    const written: number[] = []
    const write = (n: number) => {
      written.push(n)
    }
    queuePersist('k1', async () => write(1))
    queuePersist('k2', async () => write(2))

    await flushAllPersists()

    expect(written.sort()).toEqual([1, 2])
  })

  it('没有待写入内容时 flush 是空操作', async () => {
    await expect(flushPersist('nothing')).resolves.toBeUndefined()
  })

  it('写入失败不会把异常抛给调用方（事件处理里不该出现 unhandled rejection）', async () => {
    queuePersist('boom', async () => {
      throw new Error('炸了')
    })

    await expect(flushPersist('boom')).resolves.toBeUndefined()
  })
})
