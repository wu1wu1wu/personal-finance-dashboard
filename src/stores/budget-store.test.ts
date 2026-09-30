import { describe, it, expect, beforeEach, vi } from 'vitest'
import { useBudgetStore } from './budget-store'
import { createTrashEntry } from '@/core/trash'
import type { Budget } from '@/types'

function fakeLocalStorage() {
  const data: Record<string, string> = {}
  return {
    data,
    getItem: (k: string) => (k in data ? data[k] : null),
    setItem: (k: string, v: string) => void (data[k] = v),
    removeItem: (k: string) => void delete data[k],
    clear: () => Object.keys(data).forEach((k) => delete data[k]),
    key: (i: number) => Object.keys(data)[i] ?? null,
    get length() {
      return Object.keys(data).length
    },
  }
}

const budget: Budget = {
  category: '餐饮美食',
  monthlyLimit: 1000,
  color: '#EF4444',
  month: '2026-08',
}

beforeEach(() => {
  vi.stubGlobal('localStorage', fakeLocalStorage())
  useBudgetStore.setState({ budgets: [], totalBudgets: {}, loaded: true })
})

describe('restoreFromTrash', () => {
  it('把被删掉的分类预算与总预算放回来', () => {
    const entry = createTrashEntry({
      reason: 'months',
      label: '8 月',
      transactions: [],
      budgets: [budget],
      totalBudgets: { '2026-08': 3000 },
    })

    useBudgetStore.getState().restoreFromTrash(entry)

    expect(useBudgetStore.getState().budgets).toEqual([budget])
    expect(useBudgetStore.getState().totalBudgets).toEqual({ '2026-08': 3000 })
  })

  it('不覆盖用户已经重新设过的预算', () => {
    useBudgetStore.setState({ budgets: [{ ...budget, monthlyLimit: 500 }], totalBudgets: { '2026-08': 999 } })
    const entry = createTrashEntry({
      reason: 'months',
      label: '8 月',
      transactions: [],
      budgets: [budget],
      totalBudgets: { '2026-08': 3000 },
    })

    useBudgetStore.getState().restoreFromTrash(entry)

    expect(useBudgetStore.getState().budgets).toHaveLength(1)
    expect(useBudgetStore.getState().budgets[0].monthlyLimit).toBe(500)
    expect(useBudgetStore.getState().totalBudgets['2026-08']).toBe(999)
  })

  it('没有预算的批次（单笔删除）不会改动预算', () => {
    useBudgetStore.setState({ budgets: [budget], totalBudgets: { '2026-08': 3000 } })
    const entry = createTrashEntry({ reason: 'single', label: '美团', transactions: [] })

    useBudgetStore.getState().restoreFromTrash(entry)

    expect(useBudgetStore.getState().budgets).toEqual([budget])
  })
})
