import { describe, it, expect } from 'vitest'
import { CHART_COLORS, CHART_TEXT_COLORS } from './chart-colors'
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
  const tokens = readThemeTokens()

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
