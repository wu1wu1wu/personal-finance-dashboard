import { describe, it, expect } from 'vitest'
import {
  DEFAULT_FILTERS,
  countActiveFilters,
  hasAdvancedFilters,
  mergeFilterParams,
  parseFilterParams,
  type TransactionFilterState,
} from './transaction-filters'

function state(patch: Partial<TransactionFilterState> = {}): TransactionFilterState {
  return { ...DEFAULT_FILTERS, ...patch }
}

describe('parseFilterParams', () => {
  it('空参数就是默认筛选', () => {
    expect(parseFilterParams(new URLSearchParams())).toEqual(DEFAULT_FILTERS)
  })

  it('解析完整参数', () => {
    const params = new URLSearchParams(
      'category=餐饮美食&month=2026-09&direction=expense&sort=amount-desc&q=肯德基&min=10&max=100',
    )

    expect(parseFilterParams(params)).toEqual(
      state({
        category: '餐饮美食',
        month: '2026-09',
        direction: 'expense',
        sort: 'amount-desc',
        keyword: '肯德基',
        minAmount: '10',
        maxAmount: '100',
      }),
    )
  })

  it('待确认收件箱与深链', () => {
    const parsed = parseFilterParams(new URLSearchParams('pending=1&id=txn-1'))

    expect(parsed.pendingOnly).toBe(true)
    expect(parsed.deepLinkId).toBe('txn-1')
  })

  it('非法月份被清掉（否则会当前缀去匹配交易时间）', () => {
    expect(parseFilterParams(new URLSearchParams('month=2026-13')).month).toBe('')
    expect(parseFilterParams(new URLSearchParams('month=abc')).month).toBe('')
  })

  it('非法方向与排序回落到默认值', () => {
    const parsed = parseFilterParams(new URLSearchParams('direction=nope&sort=hack'))

    expect(parsed.direction).toBe('all')
    expect(parsed.sort).toBe('time-desc')
  })

  it('负数或非数字金额区间被清掉', () => {
    expect(parseFilterParams(new URLSearchParams('min=-5')).minAmount).toBe('')
    expect(parseFilterParams(new URLSearchParams('max=abc')).maxAmount).toBe('')
  })
})

describe('mergeFilterParams', () => {
  it('默认值不写进 URL', () => {
    const params = mergeFilterParams(state(), {})

    expect(params.toString()).toBe('')
  })

  it('只写非默认值', () => {
    const params = mergeFilterParams(state(), { month: '2026-09', direction: 'income' })

    expect(params.get('month')).toBe('2026-09')
    expect(params.get('direction')).toBe('income')
    expect(params.get('sort')).toBeNull()
  })

  it('收件箱模式下不带分类', () => {
    const params = mergeFilterParams(state({ category: '餐饮美食' }), { pendingOnly: true })

    expect(params.get('pending')).toBe('1')
    expect(params.get('category')).toBeNull()
  })

  it('关键词去空白并截断', () => {
    const params = mergeFilterParams(state(), { keyword: `  ${'长'.repeat(80)}  ` })

    expect(params.get('q')?.length).toBe(50)
  })

  it('深链 id 会被保留（钻取与分享都不该丢）', () => {
    const params = mergeFilterParams(state({ deepLinkId: 'txn-9' }), { month: '2026-09' })

    expect(params.get('id')).toBe('txn-9')
  })

  it('解析与序列化可以往返', () => {
    const original = state({
      category: '购物消费',
      month: '2026-08',
      direction: 'expense',
      sort: 'amount-asc',
      keyword: '京东',
      minAmount: '20',
      maxAmount: '500',
    })

    const roundTripped = parseFilterParams(mergeFilterParams(state(), original))

    expect(roundTripped).toEqual(original)
  })
})

describe('hasAdvancedFilters', () => {
  it('默认筛选没有高级条件（明细页的筛选面板默认收起）', () => {
    expect(hasAdvancedFilters(state())).toBe(false)
  })

  it('分类、月份、待确认、关键词都不算高级条件（它们各自有常驻入口）', () => {
    const visible = state({
      category: '餐饮美食',
      month: '2026-09',
      keyword: '肯德基',
      pendingOnly: true,
    })

    expect(hasAdvancedFilters(visible)).toBe(false)
  })

  it('收支方向动过就算', () => {
    expect(hasAdvancedFilters(state({ direction: 'income' }))).toBe(true)
  })

  it('排序动过就算', () => {
    expect(hasAdvancedFilters(state({ sort: 'amount-desc' }))).toBe(true)
  })

  it('金额区间有值就算', () => {
    expect(hasAdvancedFilters(state({ minAmount: '10' }))).toBe(true)
    expect(hasAdvancedFilters(state({ maxAmount: '100' }))).toBe(true)
  })
})

describe('countActiveFilters', () => {
  it('默认筛选是 0 项', () => {
    expect(countActiveFilters(state())).toBe(0)
  })

  it('逐项累加（分类与待确认算同一项）', () => {
    expect(countActiveFilters(state({ category: '餐饮美食' }))).toBe(1)
    expect(countActiveFilters(state({ pendingOnly: true, category: '餐饮美食' }))).toBe(1)
    expect(countActiveFilters(state({ month: '2026-09' }))).toBe(1)
    expect(countActiveFilters(state({ keyword: '京东' }))).toBe(1)
    expect(countActiveFilters(state({ direction: 'expense' }))).toBe(1)
    expect(countActiveFilters(state({ sort: 'time-asc' }))).toBe(1)
    expect(countActiveFilters(state({ minAmount: '10', maxAmount: '100' }))).toBe(2)
  })

  it('全开时等于各项之和', () => {
    const all = state({
      category: '餐饮美食',
      month: '2026-09',
      keyword: '京东',
      direction: 'expense',
      sort: 'amount-desc',
      minAmount: '10',
      maxAmount: '100',
    })

    expect(countActiveFilters(all)).toBe(7)
  })

  it('纯空白关键词不算（输入框里有空格不该亮角标）', () => {
    expect(countActiveFilters(state({ keyword: '   ' }))).toBe(0)
  })
})
