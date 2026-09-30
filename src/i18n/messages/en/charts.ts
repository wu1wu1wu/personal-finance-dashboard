import type { charts as zhCharts } from '../zh-CN/charts';

export const charts: Record<keyof typeof zhCharts, string> = {
  'charts.expense': 'Expense',
  'charts.income': 'Income',
  'charts.fixed': 'Fixed',
  'charts.flexible': 'Flexible',
  'charts.tooltip.amount': 'Amount: {amount}',
  'charts.tooltip.percent': 'Share: {percent}%',
  'charts.tooltip.count': '{count} transactions',
  'charts.tooltip.dailyAverage': 'Daily avg {amount}',
  'charts.summary.trend':
    'Monthly expense and income trend line chart across {months} months; the highest expense is {peakLabel} at {peakAmount}; income for the period totals {income}',
  'charts.summary.trendEmpty': 'Monthly expense and income trend: no data yet',
  'charts.summary.daily':
    'Daily expense bar chart across {days} days; daily average {average}, peak {peakAmount} ({peakLabel})',
  'charts.summary.dailyEmpty': 'Daily expense bar chart: no spending this month',
  'charts.summary.periodic':
    'Fixed vs flexible expense donut chart: fixed expenses {fixedAmount} ({fixedCount} transactions), flexible expenses {flexibleAmount} ({flexibleCount} transactions)',
};
