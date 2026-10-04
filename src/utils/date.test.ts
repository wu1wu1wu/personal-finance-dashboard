import { describe, it, expect } from 'vitest'
import {
  getMonthKey,
  getRecentMonths,
  getDaysInMonth,
  normalizeDateTime,
  isDateInMonth,
  daysBetween,
  getCurrentMonth,
  addMonthsClamped,
  getTodayLocal,
  shiftMonthKey,
} from './date'

describe('getTodayLocal', () => {
  it('用本地时区算日期，不能用 UTC（凌晨记账会掉到前一天）', () => {
    // 本地时间 2026-09-01 00:30，UTC 还是 8-31
    const localEarlyMorning = new Date(2026, 8, 1, 0, 30, 0)
    expect(getTodayLocal(localEarlyMorning)).toBe('2026-09-01')
  })

  it('补零到 yyyy-MM-dd', () => {
    expect(getTodayLocal(new Date(2026, 0, 5, 12, 0, 0))).toBe('2026-01-05')
  })
})

describe('getMonthKey', () => {
  it('从日期时间提取月份', () => {
    expect(getMonthKey('2026-07-05 14:30:00')).toBe('2026-07')
  })
})

describe('getCurrentMonth', () => {
  it('返回 yyyy-MM 格式', () => {
    expect(getCurrentMonth()).toMatch(/^\d{4}-\d{2}$/)
  })
})

describe('getRecentMonths', () => {
  it('返回指定数量且升序，最后一个是当前月', () => {
    const months = getRecentMonths(6)
    expect(months).toHaveLength(6)
    expect(months[5]).toBe(getCurrentMonth())
    expect(months).toEqual([...months].sort())
  })

  it('格式为 yyyy-MM', () => {
    for (const m of getRecentMonths(3)) {
      expect(m).toMatch(/^\d{4}-\d{2}$/)
    }
  })
})

describe('getDaysInMonth', () => {
  it('平年二月 28 天', () => {
    const days = getDaysInMonth('2026-02')
    expect(days).toHaveLength(28)
    expect(days[0]).toBe('2026-02-01')
    expect(days[27]).toBe('2026-02-28')
  })

  it('闰年二月 29 天', () => {
    expect(getDaysInMonth('2024-02')).toHaveLength(29)
  })

  it('大月 31 天', () => {
    expect(getDaysInMonth('2026-07')).toHaveLength(31)
  })
})

describe('normalizeDateTime', () => {
  it('标准格式原样返回', () => {
    expect(normalizeDateTime('2026-07-05 14:30:00')).toBe('2026-07-05 14:30:00')
  })

  it('ISO T 分隔转空格', () => {
    expect(normalizeDateTime('2026-07-05T14:30:00')).toBe('2026-07-05 14:30:00')
  })

  it('斜杠转横杠', () => {
    expect(normalizeDateTime('2026/07/05 14:30:00')).toBe('2026-07-05 14:30:00')
  })
})

describe('isDateInMonth', () => {
  it('判断日期属于某月', () => {
    expect(isDateInMonth('2026-07-05', '2026-07')).toBe(true)
    expect(isDateInMonth('2026-08-05', '2026-07')).toBe(false)
  })
})

describe('daysBetween', () => {
  it('计算两个日期的天数差', () => {
    expect(daysBetween('2026-07-01', '2026-07-05')).toBe(4)
  })
})

describe('addMonthsClamped', () => {
  it('普通加一个月', () => {
    expect(addMonthsClamped('2026-07-05', 1)).toBe('2026-08-05')
  })

  it('月末溢出时收敛到目标月最后一天', () => {
    expect(addMonthsClamped('2026-01-31', 1)).toBe('2026-02-28')
    expect(addMonthsClamped('2026-03-31', 1)).toBe('2026-04-30')
  })

  it('闰年 2 月 29 日加一年收敛到 28 日', () => {
    expect(addMonthsClamped('2024-02-29', 12)).toBe('2025-02-28')
  })

  it('季度加 3 个月', () => {
    expect(addMonthsClamped('2026-01-31', 3)).toBe('2026-04-30')
  })

  it('跨年', () => {
    expect(addMonthsClamped('2026-11-15', 2)).toBe('2027-01-15')
  })
})

describe('shiftMonthKey', () => {
  it('往前一个月会跨年', () => {
    expect(shiftMonthKey('2026-01', -1)).toBe('2025-12')
    expect(shiftMonthKey('2026-03', -3)).toBe('2025-12')
  })

  it('往后一个月会跨年', () => {
    expect(shiftMonthKey('2026-12', 1)).toBe('2027-01')
    expect(shiftMonthKey('2026-06', 7)).toBe('2027-01')
  })

  it('同月移动 0 个月是恒等', () => {
    expect(shiftMonthKey('2026-09', 0)).toBe('2026-09')
  })

  it('非法输入原样返回，不抛异常', () => {
    expect(shiftMonthKey('2026-13', 1)).toBe('2026-13')
    expect(shiftMonthKey('', 1)).toBe('')
    expect(shiftMonthKey('2026-9', 1)).toBe('2026-9')
  })
})
