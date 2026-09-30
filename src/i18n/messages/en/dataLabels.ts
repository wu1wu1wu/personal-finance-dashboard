import type { dataLabels as zhDataLabels } from '../zh-CN/dataLabels';

export const dataLabels: Record<keyof typeof zhDataLabels, string> = {
  'category.dining': 'Dining',
  'category.transport': 'Transport',
  'category.shopping': 'Shopping',
  'category.entertainment': 'Entertainment',
  'category.living': 'Home & living',
  'category.health': 'Health',
  'category.education': 'Education',
  'category.transfer': 'Transfer',
  'category.other': 'Other',
  'category.pending': 'Needs review',
  'transactionType.expense': 'Spending',
  'transactionType.income': 'Income',
  'transactionType.other': 'Other',
  'period.monthly': 'Monthly',
  'period.quarterly': 'Quarterly',
  'period.yearly': 'Yearly',
};
