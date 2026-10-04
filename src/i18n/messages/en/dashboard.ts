import type { dashboard as zhDashboard } from '../zh-CN/dashboard';

export const dashboard: Record<keyof typeof zhDashboard, string> = {
  'dashboard.title': 'Dashboard',
  'dashboard.reportLink': 'Monthly report',
  'dashboard.viewOverview': 'Overview',
  'dashboard.viewNotes': 'Memos',
  'dashboard.viewSwitcherLabel': 'Dashboard view',
  'dashboard.emptyTitle': 'No records yet',
  'dashboard.emptyHint':
    'Tap "Add" at the bottom (top right on desktop), or import a WeChat bill in Settings',
  'dashboard.pendingSuffix_one': 'transaction needs a category',
  'dashboard.pendingSuffix_other': 'transactions need a category',
  'dashboard.pendingAction': 'Review',
  'dashboard.monthExpense': 'Spending this month',
  'dashboard.monthTxnCount_one': '1 transaction in total',
  'dashboard.monthTxnCount_other': '{count} transactions in total',
  'dashboard.transferNote': 'plus {amount} in transfers, not counted as spending',
  'dashboard.recentTitle': 'Recent transactions',
  'dashboard.viewAll': 'View all',
  'dashboard.moreAnalysis': 'More analysis',
  'dashboard.notesEmptyTitle': 'No memos this month',
  'dashboard.notesEmptyHint':
    'Open a record in Transactions and add a memo or an image to see it here',
  'dashboard.trendTitle': 'Monthly trend',
  'dashboard.dailyTitle': 'Daily spending',
  'dashboard.categoryPieTitle': 'Category share',
  'dashboard.noExpenseThisMonth': 'No spending this month',
  'dashboard.clickForDetail': 'Tap to see details',
};
