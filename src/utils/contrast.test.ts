import { describe, it, expect } from 'vitest'
import { contrastRatio, meetsAA, relativeLuminance } from './contrast'
import { readThemeTokens } from '@/test/theme-tokens'

describe('contrastRatio', () => {
  it('黑白对比度是 21:1', () => {
    expect(contrastRatio('#ffffff', '#000000')).toBeCloseTo(21, 5)
  })

  it('同色对比度是 1:1', () => {
    expect(contrastRatio('#2563eb', '#2563eb')).toBeCloseTo(1, 5)
  })

  it('支持 #rgb 简写', () => {
    expect(contrastRatio('#fff', '#000')).toBeCloseTo(21, 5)
  })

  it('相对亮度：白 1、黑 0', () => {
    expect(relativeLuminance('#ffffff')).toBeCloseTo(1, 5)
    expect(relativeLuminance('#000000')).toBeCloseTo(0, 5)
  })

  it('大字/图形用 3:1 门槛', () => {
    // 改造前的支出色 #e5484d：正文不达标（3.91:1），但作为图形/大字够用
    expect(meetsAA('#e5484d', '#ffffff')).toBe(false)
    expect(meetsAA('#e5484d', '#ffffff', true)).toBe(true)
  })
})

describe('主题配色的对比度（回归守卫）', () => {
  const t = readThemeTokens('@theme')

  const hex = (name: string): string => {
    const value = t[name]
    if (!value) throw new Error(`index.css 里缺少 --color-${name}`)
    return value
  }

  it('正文灰阶在白底与 canvas 底都达到 4.5:1', () => {
    for (const name of ['ink', 'ink-muted', 'ink-subtle']) {
      expect(meetsAA(hex(name), hex('surface')), `${name} 对白底`).toBe(true)
      expect(meetsAA(hex(name), hex('canvas')), `${name} 对 canvas`).toBe(true)
    }
  })

  it('支出/收入在主色底与各自的浅色底上都达到 4.5:1', () => {
    expect(meetsAA(hex('expense'), hex('surface'))).toBe(true)
    expect(meetsAA(hex('expense'), hex('expense-soft'))).toBe(true)
    expect(meetsAA(hex('income'), hex('surface'))).toBe(true)
    expect(meetsAA(hex('income'), hex('income-soft'))).toBe(true)
  })

  it('预警与品牌色在各自浅色底上达到 4.5:1', () => {
    expect(meetsAA(hex('alert'), hex('alert-soft'))).toBe(true)
    expect(meetsAA(hex('brand'), hex('brand-soft'))).toBe(true)
  })

  it('次要灰阶比主灰阶更浅（视觉层级不能被对比度修正搞反）', () => {
    expect(relativeLuminance(hex('ink-subtle'))).toBeGreaterThan(relativeLuminance(hex('ink-muted')))
    expect(relativeLuminance(hex('ink-muted'))).toBeGreaterThan(relativeLuminance(hex('ink')))
  })
})

describe('深色主题配色的对比度（回归守卫）', () => {
  const dark = readThemeTokens('.dark')

  const hex = (name: string): string => {
    const value = dark[name]
    if (!value) throw new Error(`index.css 的 .dark 里缺少 --color-${name}`)
    return value
  }

  it('.dark 覆盖了浅色的一整套令牌（不能只覆盖一半，否则会出现白底黑字）', () => {
    const lightNames = Object.keys(readThemeTokens()).sort()
    expect(Object.keys(dark).sort()).toEqual(lightNames)
  })

  it('正文灰阶在深色 canvas 与 surface 上都达到 4.5:1', () => {
    for (const name of ['ink', 'ink-muted', 'ink-subtle']) {
      expect(meetsAA(hex(name), hex('surface')), `${name} 对 surface`).toBe(true)
      expect(meetsAA(hex(name), hex('canvas')), `${name} 对 canvas`).toBe(true)
    }
  })

  it('支出/收入在深色底与各自的浅色底上都达到 4.5:1', () => {
    expect(meetsAA(hex('expense'), hex('surface'))).toBe(true)
    expect(meetsAA(hex('expense'), hex('expense-soft'))).toBe(true)
    expect(meetsAA(hex('income'), hex('surface'))).toBe(true)
    expect(meetsAA(hex('income'), hex('income-soft'))).toBe(true)
  })

  it('预警与品牌色在深色浅底上达到 4.5:1', () => {
    expect(meetsAA(hex('alert'), hex('alert-soft'))).toBe(true)
    expect(meetsAA(hex('brand'), hex('brand-soft'))).toBe(true)
  })

  it('深色下层级方向相反：ink 最亮、ink-subtle 最暗', () => {
    expect(relativeLuminance(hex('ink'))).toBeGreaterThan(relativeLuminance(hex('ink-muted')))
    expect(relativeLuminance(hex('ink-muted'))).toBeGreaterThan(relativeLuminance(hex('ink-subtle')))
  })
})
