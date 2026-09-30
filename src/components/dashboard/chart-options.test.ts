import { describe, it, expect, vi } from 'vitest'
import { echarts } from '@/components/charts/register'
import {
  buildTrendOption,
  buildDailyOption,
  buildPieOption,
  buildPeriodicBreakdownOption,
  summarizeTrend,
  summarizeDaily,
  summarizePeriodicBreakdown,
} from './chart-options'
import type { ChartOption } from '@/components/charts/register'
import { CHART_COLORS, DARK_CHART_COLORS } from '@/constants/chart-colors'
import type {
  CategoryBreakdownPoint,
  DailySpendPoint,
  MonthlyTrendPoint,
} from '@/core/dashboard-engine'
import type { PeriodicBreakdown } from '@/core/periodic-engine'

const trend: MonthlyTrendPoint[] = [
  { month: '2026-07', label: '7月', expense: 1200, income: 8000 },
  { month: '2026-08', label: '8月', expense: 6266, income: 8000 },
  { month: '2026-09', label: '9月', expense: 300, income: 0 },
]

const daily: DailySpendPoint[] = [
  { day: '2026-09-01', label: '1日', amount: 0 },
  { day: '2026-09-05', label: '5日', amount: 120 },
  { day: '2026-09-06', label: '6日', amount: 40 },
]

const pie: CategoryBreakdownPoint[] = [
  { category: '餐饮美食', amount: 300, percentage: 60, color: '#EF4444', icon: '🍜', count: 12 },
  { category: '交通出行', amount: 200, percentage: 40, color: '#3B82F6', icon: '🚗', count: 5 },
]

const breakdown: PeriodicBreakdown = {
  fixedAmount: 2400,
  flexibleAmount: 600,
  fixedCount: 3,
  flexibleCount: 8,
  fixedByCategory: { 居住生活: 2400 },
}

/**
 * 用 ECharts 的 SSR 模式在 node 里真渲染一遍。
 * 按需注册（register.ts）如果漏了某个图表/组件，这一步会缺内容或报
 * "used but not imported"，测试就会失败——这是注册集完整性的自动化证据。
 */
function renderToSvg(option: ChartOption): string {
  const chart = echarts.init(null, null, {
    ssr: true,
    renderer: 'svg',
    width: 600,
    height: 300,
  })
  try {
    chart.setOption(option)
    return chart.renderToSVGString()
  } finally {
    chart.dispose()
  }
}

describe('图表 option 能在按需注册下渲染出来', () => {
  it('月度趋势折线图', () => {
    const svg = renderToSvg(buildTrendOption(trend))

    expect(svg).toContain('<svg')
    expect(svg).toContain('支出')
    expect(svg).toContain('收入')
    expect(svg.length).toBeGreaterThan(1000)
  })

  it('深色调色板下四张图同样能渲染（图表配色跟随外观）', () => {
    const dark = DARK_CHART_COLORS
    const svgs = [
      renderToSvg(buildTrendOption(trend, dark)),
      renderToSvg(buildDailyOption(daily, dark)),
      renderToSvg(buildPieOption(pie, dark)),
      renderToSvg(buildPeriodicBreakdownOption(breakdown, dark)),
    ]

    for (const svg of svgs) {
      expect(svg).toContain('<svg')
      expect(svg.length).toBeGreaterThan(500)
    }
    // 支出线用的是深色主题的红，而不是浅色那支
    expect(svgs[0]).toContain(dark.expense)
    expect(svgs[0]).not.toContain(CHART_COLORS.expense)
  })

  it('每日支出柱状图，含日均参考线（需要 MarkLineComponent）', () => {
    const svg = renderToSvg(buildDailyOption(daily))

    expect(svg).toContain('日均')
    expect(svg.length).toBeGreaterThan(1000)
  })

  it('分类占比环形图', () => {
    const svg = renderToSvg(buildPieOption(pie))

    expect(svg).toContain('<path')
    expect(svg.length).toBeGreaterThan(500)
  })

  it('固定/弹性环形图', () => {
    const svg = renderToSvg(buildPeriodicBreakdownOption(breakdown))

    expect(svg).toContain('<path')
    expect(svg.length).toBeGreaterThan(500)
  })

  it('渲染过程中没有 ECharts 告警（漏注册、用了废弃配置都会在这里暴露）', () => {
    const messages: string[] = []
    const collect = (...args: unknown[]) => {
      messages.push(args.map(String).join(' '))
    }
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(collect)
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(collect)

    renderToSvg(buildTrendOption(trend))
    renderToSvg(buildDailyOption(daily))
    renderToSvg(buildPieOption(pie))
    renderToSvg(buildPeriodicBreakdownOption(breakdown))

    errorSpy.mockRestore()
    warnSpy.mockRestore()
    expect(messages).toEqual([])
  })
})

describe('图表文字替代（给屏幕阅读器的摘要）', () => {
  it('趋势摘要点出支出最高的月份与金额', () => {
    const text = summarizeTrend(trend)

    expect(text).toContain('8月')
    expect(text).toContain('6,266.00元')
  })

  it('每日支出摘要给出日均与峰值', () => {
    const text = summarizeDaily(daily)

    expect(text).toContain('日均')
    expect(text).toContain('120.00元')
  })

  it('没有数据时给出明确的空状态描述', () => {
    expect(summarizeTrend([])).toContain('暂无数据')
    expect(summarizeDaily([])).toContain('暂无支出')
  })

  it('固定/弹性摘要包含两侧金额与笔数', () => {
    const text = summarizePeriodicBreakdown(breakdown)

    expect(text).toContain('2,400.00元')
    expect(text).toContain('600.00元')
    expect(text).toContain('3 笔')
    expect(text).toContain('8 笔')
  })
})
