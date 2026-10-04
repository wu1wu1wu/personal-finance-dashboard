import { describe, it, expect } from 'vitest'
import {
  buildYearMonths,
  monthsWithDataInYear,
  parseMonthKey,
  shiftYear,
  toMonthKey,
  yearBounds,
} from './month-picker'

describe('parseMonthKey / toMonthKey', () => {
  it('解析合法的月份键', () => {
    expect(parseMonthKey('2026-09')).toEqual({ year: 2026, month: 9 })
  })

  it('非法键返回 null（13 月、缺位、空串）', () => {
    expect(parseMonthKey('2026-13')).toBeNull()
    expect(parseMonthKey('2026-9')).toBeNull()
    expect(parseMonthKey('')).toBeNull()
    expect(parseMonthKey(undefined as unknown as string)).toBeNull()
  })

  it('拼回月份键时补零', () => {
    expect(toMonthKey(2026, 9)).toBe('2026-09')
    expect(toMonthKey(2026, 12)).toBe('2026-12')
  })

  it('月份越界不猜，直接给空串（调用方按空值兜底）', () => {
    expect(toMonthKey(2026, 0)).toBe('')
    expect(toMonthKey(2026, 13)).toBe('')
    expect(toMonthKey(0, 5)).toBe('')
  })

  it('解析与拼装可以往返', () => {
    const parts = parseMonthKey('2025-01')
    expect(parts && toMonthKey(parts.year, parts.month)).toBe('2025-01')
  })
})

describe('buildYearMonths', () => {
  it('给出一整年的 12 个月份键，按顺序', () => {
    const months = buildYearMonths(2026)

    expect(months).toHaveLength(12)
    expect(months[0]).toBe('2026-01')
    expect(months[11]).toBe('2026-12')
    expect(months).toContain('2026-09')
  })
})

describe('shiftYear', () => {
  it('前后翻一年，月份保持不变', () => {
    expect(shiftYear('2026-09', -1)).toBe('2025-09')
    expect(shiftYear('2026-09', 1)).toBe('2027-09')
  })

  it('跨世纪也不出错', () => {
    expect(shiftYear('2000-01', -1)).toBe('1999-01')
  })

  it('非法输入原样返回，交给调用方兜底', () => {
    expect(shiftYear('abc', 1)).toBe('abc')
    expect(shiftYear('', 1)).toBe('')
  })
})

describe('monthsWithDataInYear', () => {
  it('只挑出这一年的月份，去重后返回月份数字', () => {
    const data = ['2026-09', '2026-09', '2026-01', '2025-12', 'bad-key']

    expect(monthsWithDataInYear(data, 2026)).toEqual(new Set([1, 9]))
  })

  it('没有数据的年份是空集合', () => {
    expect(monthsWithDataInYear(['2026-09'], 2024).size).toBe(0)
  })
})

describe('yearBounds', () => {
  const now = new Date(2026, 8, 15) // 2026-09-15

  it('最早到有数据的那一年，最晚算上下个月所在的年', () => {
    expect(yearBounds('2026-09', ['2024-03', '2026-09'], now)).toEqual({
      min: 2024,
      max: 2026,
    })
  })

  it('十二月时把下一年算进来（预算可以提前给下个月设）', () => {
    const december = new Date(2026, 11, 20)

    expect(yearBounds('2026-12', [], december).max).toBe(2027)
  })

  it('数据在未来时上限跟着未来走（导入过未来月份的账单）', () => {
    expect(yearBounds('2026-09', ['2028-02'], now).max).toBe(2028)
  })

  it('锚点是过去的老月份时，今年仍然可选', () => {
    expect(yearBounds('2023-05', [], now)).toEqual({ min: 2023, max: 2026 })
  })

  it('锚点非法时只看数据与今年（不崩）', () => {
    expect(yearBounds('bad', ['2025-06'], now)).toEqual({ min: 2025, max: 2026 })
  })
})
