import type { recurring as zhRecurring } from '../zh-CN/recurring';

export const recurring: Record<keyof typeof zhRecurring, string> = {
  'recurring.title': 'Recurring charges',
  'recurring.monthlyTotal': 'Fixed monthly cost',
  'recurring.dueTitle': 'Due soon',
  'recurring.overdueTitle': 'Expected but not recorded',
  'recurring.overdueHint':
    'The expected charge date has passed with no record — it may have been cancelled, or a charge was missed.',
  'recurring.expectedOn': 'Expected {date}',
  'recurring.today': 'today',
  'recurring.inDays_one': 'in 1 day',
  'recurring.inDays_other': 'in {count} days',
  'recurring.overdueDays_one': '1 day late',
  'recurring.overdueDays_other': '{count} days late',
  'recurring.priceChanged': 'Amount changed {previous} → {amount}',
  'recurring.ignore': 'Stop reminding me about {name}',
  'recurring.ignoredTitle': '{count} ignored',
  'recurring.restore': 'Resume reminders for {name}',
  'recurring.empty': 'Recurring charges are detected after three months of records',
  'recurring.summary_one': '{count} charge',
  'recurring.summary_other': '{count} charges',
};
