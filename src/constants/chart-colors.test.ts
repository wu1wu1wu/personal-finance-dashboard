import { describe, it, expect } from 'vitest'
import {
  CHART_COLORS,
  CHART_TEXT_COLORS,
  DARK_CHART_COLORS,
  DARK_CHART_TEXT_COLORS,
  withAlpha,
} from './chart-colors'
import { meetsAA } from '@/utils/contrast'
import { readThemeTokens } from '@/test/theme-tokens'

/**
 * 图表色与 index.css 令牌的对应关系（成对维护，改一边不改另一边会被这里拦住）。
 * gridLine 只有图表在用（虚线网格），没有同名的主题令牌，故不在此表内。
 */
const TOKEN_MAP: Array<[keyof typeof CHART_COLORS, string]> = [
  ['expense', 'expense'],
  ['income', 'income'],
  ['alert', 'alert'],
  ['brand', 'brand'],
  ['axisLabel', 'ink-subtle'],
  ['legendText', 'ink-muted'],
  ['axisLine', 'line'],
  ['surface', 'surface'],
]

describe('图表配色', () => {
  const tokens = readThemeTokens('@theme')

  it('文本色（坐标轴、图例）在白底达到 4.5:1', () => {
    for (const color of CHART_TEXT_COLORS) {
      expect(meetsAA(color, '#ffffff'), `${color} 对白底`).toBe(true)
    }
  })

  it('图表色与 index.css 的主题令牌保持一致', () => {
    for (const [key, token] of TOKEN_MAP) {
      expect(CHART_COLORS[key], `${key} 应与 --color-${token} 同值`).toBe(tokens[token])
    }
  })

  it('图形色（柱、扇区）达到图形对比度 3:1', () => {
    for (const color of [CHART_COLORS.bar, CHART_COLORS.fixed, CHART_COLORS.flexible]) {
      expect(meetsAA(color, '#ffffff', true), `${color} 对白底`).toBe(true)
    }
  })
})

describe('深色图表配色', () => {
  const darkTokens = readThemeTokens('.dark')

  it('深色调色板与 .dark 令牌保持一致', () => {
    for (const [key, token] of TOKEN_MAP) {
      expect(DARK_CHART_COLORS[key], `${key} 应与 .dark 的 --color-${token} 同值`).toBe(
        darkTokens[token],
      )
    }
  })

  it('深色文本色对深色卡片底达到 4.5:1', () => {
    for (const color of DARK_CHART_TEXT_COLORS) {
      expect(meetsAA(color, DARK_CHART_COLORS.surface), `${color} 对深色底`).toBe(true)
    }
  })

  it('深色图形色达到图形对比度 3:1', () => {
    for (const color of [
      DARK_CHART_COLORS.bar,
      DARK_CHART_COLORS.fixed,
      DARK_CHART_COLORS.flexible,
    ]) {
      expect(meetsAA(color, DARK_CHART_COLORS.surface, true), `${color} 对深色底`).toBe(true)
    }
  })

  it('浅深两套调色板的字段完全对齐（少一个字段会在切换主题时露出旧颜色）', () => {
    const expected = [
      'alert',
      'axisLabel',
      'axisLine',
      'bar',
      'brand',
      'expense',
      'fixed',
      'flexible',
      'gridLine',
      'income',
      'legendText',
      'surface',
    ]

    expect(Object.keys(CHART_COLORS).sort()).toEqual(expected)
    expect(Object.keys(DARK_CHART_COLORS).sort()).toEqual(expected)
  })
})

describe('withAlpha', () => {
  it('把十六进制转成 rgba', () => {
    expect(withAlpha('#c92a2e', 0.14)).toBe('rgba(201, 42, 46, 0.14)')
  })

  it('支持 #rgb 简写', () => {
    expect(withAlpha('#fff', 1)).toBe('rgba(255, 255, 255, 1)')
  })
})
