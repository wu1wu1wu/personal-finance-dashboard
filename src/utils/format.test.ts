import { describe, it, expect } from 'vitest'
import {
  formatCurrency,
  formatCurrencyShort,
  parseAmount,
  formatDateShort,
  formatMonthKey,
} from './format'

describe('parseAmount', () => {
  it('解析带 ¥ 符号的金额', () => {
    expect(parseAmount('¥128.50')).toBe(128.5)
  })

  it('解析负数金额', () => {
    expect(parseAmount('-¥50.00')).toBe(-50)
  })

  it('去掉「元」后缀', () => {
    expect(parseAmount('¥3.00元')).toBe(3)
  })

  it('处理 ¥ 被错误解析为「日」的情况', () => {
    expect(parseAmount('日3.00')).toBe(3)
  })

  it('去掉千分位逗号', () => {
    expect(parseAmount('1,234.56')).toBe(1234.56)
  })

  it('空字符串返回 0', () => {
    expect(parseAmount('')).toBe(0)
  })

  it('非数字字符串返回 0', () => {
    expect(parseAmount('abc')).toBe(0)
  })
})

describe('formatCurrency', () => {
  it('默认不显示符号，保留两位小数', () => {
    expect(formatCurrency(128.5)).toBe('128.50元')
    expect(formatCurrency(-50)).toBe('50.00元')
  })

  it('showSign 时显示正负号', () => {
    expect(formatCurrency(100, true)).toBe('+100.00元')
    expect(formatCurrency(-100, true)).toBe('-100.00元')
  })
})

describe('formatCurrencyShort', () => {
  it('超过一万时用「万元」', () => {
    expect(formatCurrencyShort(15000)).toBe('1.5万元')
  })

  it('不足一万时用普通格式', () => {
    expect(formatCurrencyShort(999)).toBe('999.00元')
  })
})

describe('formatDateShort', () => {
  it('格式化为中文显示', () => {
    expect(formatDateShort('2026-07-05 14:30:00')).toBe('7月5日 14:30')
  })

  it('无效日期原样返回', () => {
    expect(formatDateShort('invalid')).toBe('invalid')
  })
})

describe('formatMonthKey', () => {
  it('从日期时间提取月份键', () => {
    expect(formatMonthKey('2026-07-05 14:30:00')).toBe('2026-07')
  })
})
