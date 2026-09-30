// ============================================================
// 图表文案（ECharts 读不到 React hook，由调用方通过 useChartLabels() 传进去）
//
// tooltip / 摘要里的 {占位符} 用 interpolate() 填充，中英两边的占位符必须一致。
// ============================================================

export const charts = {
  'charts.expense': '支出',
  'charts.income': '收入',
  'charts.fixed': '固定开销',
  'charts.flexible': '弹性开销',
  'charts.tooltip.amount': '金额: {amount}',
  'charts.tooltip.percent': '占比: {percent}%',
  'charts.tooltip.count': '笔数: {count} 笔',
  'charts.tooltip.dailyAverage': '日均 {amount}',
  'charts.summary.trend':
    '月度支出与收入趋势折线图，共 {months} 个月；支出最高的是 {peakLabel}，{peakAmount}；期间收入合计 {income}',
  'charts.summary.trendEmpty': '月度支出与收入趋势：暂无数据',
  'charts.summary.daily': '每日支出柱状图，共 {days} 天；日均 {average}，最高 {peakAmount}（{peakLabel}）',
  'charts.summary.dailyEmpty': '每日支出柱状图：本月暂无支出',
  'charts.summary.periodic':
    '固定与弹性开销环形图：固定开销 {fixedAmount}（{fixedCount} 笔），弹性开销 {flexibleAmount}（{flexibleCount} 笔）',
} as const;
