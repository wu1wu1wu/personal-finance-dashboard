import { describe, it, expect, vi } from 'vitest'
import { echarts } from '@/components/charts/register'
import {
  buildTrendOption,
  buildDailyOption,
  buildPieOption,
  buildPeriodicBreakdownOption,
  buildAxisFormatter,
  summarizeTrend,
  summarizeDaily,
  summarizePeriodicBreakdown,
} from './chart-options'
import type { ChartOption } from '@/components/charts/register'
import { createTranslator } from '@/i18n'
import type { ChartLabels } from './chart-options'
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

describe('图表文案跟随语言（labels / t 真的传到了 ECharts）', () => {
  const en = createTranslator('en')

  /** 与 useChartLabels() 同一组取值，只是不经过 React */
  const EN_LABELS: ChartLabels = {
    expense: en.t('charts.expense'),
    income: en.t('charts.income'),
    amountLine: en.t('charts.tooltip.amount'),
    percentLine: en.t('charts.tooltip.percent'),
    countLine: en.t('charts.tooltip.count'),
    dailyAverageLine: en.t('charts.tooltip.dailyAverage'),
    fixed: en.t('charts.fixed'),
    flexible: en.t('charts.flexible'),
    formatAxisValue: buildAxisFormatter('en'),
  }

  it('传英文 labels 时图例/系列名换成英文，中文不再出现', () => {
    const svg = renderToSvg(buildTrendOption(trend, CHART_COLORS, EN_LABELS))

    expect(svg).toContain('Expense')
    expect(svg).toContain('Income')
    expect(svg).not.toContain('支出')
  })

  it('传英文 labels 时环形图两个扇区名也换成英文', () => {
    const option = buildPeriodicBreakdownOption(breakdown, CHART_COLORS, EN_LABELS)

    // 扇区名只在 tooltip 里可见（label 是关掉的），所以直接查 option 结构
    const json = JSON.stringify(option)
    expect(json).toContain('"name":"Fixed"')
    expect(json).toContain('"name":"Flexible"')
    expect(renderToSvg(option)).toContain('<path')
  })

  it('摘要用英文翻译器时输出英文，占位符全部填上', () => {
    const trendText = summarizeTrend(trend, en.t)
    const dailyText = summarizeDaily(daily, en.t)
    const periodicText = summarizePeriodicBreakdown(breakdown, en.t)

    expect(trendText).toContain('Monthly expense and income trend')
    expect(trendText).toContain('3 months')
    expect(trendText).toContain('6,266.00元')
    expect(dailyText).toContain('3 days')
    expect(periodicText).toContain('3 transactions')
    expect(periodicText).toContain('8 transactions')

    for (const text of [trendText, dailyText, periodicText]) {
      expect(text).not.toMatch(/\{\w+\}/)
    }
  })

  it('空数据分支也走文案表', () => {
    expect(summarizeTrend([], en.t)).toBe('Monthly expense and income trend: no data yet')
    expect(summarizeDaily([], en.t)).toBe('Daily expense bar chart: no spending this month')
  })

  it('坐标轴按各自语言的进位单位压缩：中文用万，英文用 k', () => {
    const zh = buildAxisFormatter('zh-CN')
    const enAxis = buildAxisFormatter('en')

    // 中文：≥10000 走万
    expect(zh(9999)).toBe('9999')
    expect(zh(30000)).toBe('3万')
    // 英文：≥1000 走 k，且不能被万整除而失真（25000 必须是 25k，不是 30k）
    expect(enAxis(999)).toBe('999')
    expect(enAxis(25000)).toBe('25k')
    expect(enAxis(1500)).toBe('2k')
  })

  it('英文坐标轴真的渲染成 k，中文渲染成万', () => {
    // 让趋势数据里出现 25000 与 30000 这两个量级
    const bigTrend: MonthlyTrendPoint[] = [
      { month: '2026-07', label: '7', expense: 25000, income: 0 },
      { month: '2026-08', label: '8', expense: 30000, income: 0 },
    ]

    const enSvg = renderToSvg(buildTrendOption(bigTrend, CHART_COLORS, EN_LABELS))
    const zhSvg = renderToSvg(buildTrendOption(bigTrend, CHART_COLORS))

    expect(enSvg).toContain('25k')
    // 英文里不该出现中文单位（老实现用 '0k' 后缀，25000 会被显示成 30k）
    expect(enSvg).not.toContain('万')
    expect(zhSvg).toContain('3万')
  })

  it('扇区名用本地化后的 displayName，但 data 里保留 category 原值供钻取', () => {
    const localized: CategoryBreakdownPoint[] = [
      {
        category: '餐饮美食',
        displayName: 'Dining',
        amount: 120,
        percentage: 100,
        color: '#EF4444',
        icon: '🍜',
        count: 3,
      },
    ]

    const json = JSON.stringify(buildPieOption(localized, CHART_COLORS, EN_LABELS))

    expect(json).toContain('"name":"Dining"')
    expect(json).toContain('"category":"餐饮美食"')
    // 扇区名不该再是中文
    expect(json).not.toContain('"name":"餐饮美食"')
  })

  it('没有 displayName 时退回 category 原值（老调用方不受影响）', () => {
    const json = JSON.stringify(buildPieOption(pie, CHART_COLORS, EN_LABELS))

    expect(json).toContain('"name":"餐饮美食"')
    expect(json).toContain('"category":"餐饮美食"')
  })
})
