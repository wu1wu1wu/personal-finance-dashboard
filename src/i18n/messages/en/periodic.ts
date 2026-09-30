import type { periodic as zhPeriodic } from '../zh-CN/periodic';

export const periodic: Record<keyof typeof zhPeriodic, string> = {
  'periodic.title': 'Recurring transactions',
  'periodic.listTitle': 'Recurring transactions',
  'periodic.emptyTitle': 'No recurring transactions detected',
  'periodic.emptyHint':
    'Charges of the same amount for three months in a row are detected automatically',
  'periodic.detected_one': 'Detected 1 item',
  'periodic.detected_other': 'Detected {count} items',
  'periodic.unknownCounterparty': 'Unknown',
  'periodic.nextExpected': 'Next expected {date}',
  'periodic.lastSeen': 'Last on {date}',
  'periodic.unmark': 'Unmark {name} as recurring',
  'periodic.period.monthly': 'Monthly',
  'periodic.period.quarterly': 'Quarterly',
  'periodic.period.yearly': 'Yearly',
  'periodic.breakdownTitle': 'Fixed vs flexible',
  'periodic.noExpenseThisMonth': 'No spending data this month',
};
