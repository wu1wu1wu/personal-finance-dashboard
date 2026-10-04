import type { transactions as zhTransactions } from '../zh-CN/transactions';

export const transactions: Record<keyof typeof zhTransactions, string> = {
  'transactions.title': 'Transactions',

  // Filters and sorting
  'transactions.directionGroup': 'Direction',
  'transactions.sort.label': 'Sort by',
  'transactions.sort.timeDesc': 'Time: newest first',
  'transactions.sort.timeAsc': 'Time: oldest first',
  'transactions.sort.amountDesc': 'Amount: high to low',
  'transactions.sort.amountAsc': 'Amount: low to high',
  'transactions.searchLabel': 'Search by merchant or description',
  'transactions.searchPlaceholder': 'Search by merchant or description…',
  'transactions.minAmount': 'Min amount',
  'transactions.maxAmount': 'Max amount',
  'transactions.amountTo': 'to',
  'transactions.clearAmountFilter': 'Clear amount filter',
  // Filter toolbar: advanced conditions stay collapsed by default
  'transactions.filter.toggle': 'Filters',
  'transactions.filter.toggleWithCount': 'Filters, {count} active',
  'transactions.filter.advanced': 'More filter conditions',
  'transactions.filter.advancedHint': 'Direction, sorting and amount range',
  'transactions.filter.clearAdvanced': 'Clear these',
  'transactions.categoryFilterPrefix': 'Category:',
  'transactions.pendingInboxPrefix': 'Pending inbox:',
  'transactions.clearCategoryFilter': 'Clear category filter',
  'transactions.exitInbox': 'Exit inbox',

  // Summary and re-classification
  'transactions.summaryCount_one': '{count} transaction',
  'transactions.summaryCount_other': '{count} transactions',
  'transactions.summary.expense': 'Spending: {amount}',
  'transactions.summary.income': 'Income: {amount}',
  'transactions.summary.transfer': 'Transfers: {amount}',
  'transactions.reclassify': 'Re-classify',
  'transactions.reclassify.done_one': 'Re-classified 1 transaction',
  'transactions.reclassify.done_other': 'Re-classified {count} transactions',
  'transactions.reclassify.empty': 'Nothing could be re-classified automatically',

  // Bulk categorization
  'transactions.batch.enter': 'Bulk categorize',
  'transactions.batch.selected_one': '1 transaction selected',
  'transactions.batch.selected_other': '{count} transactions selected',
  'transactions.batch.setCategory': 'Set category',
  'transactions.deleted_one': 'Deleted 1 transaction',
  'transactions.deleted_other': 'Deleted {count} transactions',

  // Empty states
  'transactions.empty.title': 'No transactions yet',
  'transactions.empty.hint':
    'Import a WeChat bill from Settings, or tap "Add" at the bottom (top right on desktop)',
  'transactions.emptyFiltered.title': 'No transactions match these filters',
  'transactions.emptyFiltered.action': 'Clear all filters',

  // List rows and cards
  'transactions.unknown': 'Unknown transaction',
  'transactions.thisTransaction': 'this transaction',
  'transactions.viewDetail': 'View details for {name}',
  'transactions.selectItem': 'Select {name}',
  'transactions.deleteNamed': 'Delete {name}',
  'transactions.confirmDelete': 'Confirm delete',
  'transactions.overLimit': 'Over the per-transaction limit of {amount}',
  'transactions.untitled': 'Untitled',

  // Memos (cards in the dashboard "Memos" view)
  'transactions.note.editNamed': 'Edit memo: {name}',
  'transactions.note.placeholder': 'Add a memo…',
  'transactions.note.remove': 'Remove memo and image',
  'transactions.note.removed': 'Memo removed',
  'transactions.note.cleared': 'Memo cleared',
  'transactions.note.addCover': 'Add image',
  'transactions.note.replaceCover': 'Replace image',
  'transactions.note.removeCover': 'Remove image',

  // Add transaction
  'transactions.add.title': 'Add transaction',
  'transactions.add.description': 'Amount and merchant are required',
  'transactions.add.amountLabel': 'Amount (CNY)',
  'transactions.add.counterpartyPlaceholder': 'e.g. Starbucks',

  // Field labels
  'transactions.field.transactionTime': 'Time',
  'transactions.field.transactionType': 'Type',
  'transactions.field.counterparty': 'Merchant',
  'transactions.field.itemDescription': 'Description',
  'transactions.field.note': 'Note',
  'transactions.field.paymentMethod': 'Payment method',
  'transactions.field.paymentStatus': 'Status',
  'transactions.field.transactionNo': 'Order number',
  'transactions.field.categorySource': 'Category source',
  'transactions.field.periodic': 'Recurring',
  'transactions.field.importedAt': 'Imported at',
  'transactions.field.theme': 'Memo',
  'transactions.field.tags': 'Tags',
  'transactions.field.date': 'Date',

  // Category source and booleans
  'transactions.source.manual': 'Set manually',
  'transactions.source.rule': 'Custom rule',
  'transactions.source.guessed': 'Guessed from history',
  'transactions.source.auto': 'Auto-detected',
  'transactions.yes': 'Yes',
  'transactions.no': 'No',

  // Detail modal
  'transactions.deleteThis': 'Delete this transaction',
  'transactions.detail.overLimit':
    'This {amount} charge is over the {limit} per-transaction limit for "{category}" by {excess}.',
  'transactions.detail.themePlaceholder': 'Add a memo to this bill, e.g. dinner with friends',
  'transactions.detail.themeHint': 'Bills with a memo or an image show up in the dashboard Memos view',
  'transactions.detail.coverAlt': 'Bill cover image',
  'transactions.detail.uploading': 'Uploading…',
  'transactions.detail.replaceCover': 'Replace image',
  'transactions.detail.addCover': 'Add image',
  'transactions.detail.removeCover': 'Remove',
  'transactions.detail.quickCategorize': 'Quick categorize',
  'transactions.detail.section': 'Details',
  'transactions.detail.editHint': 'Edited records will not be overwritten by later imports.',
  'transactions.detail.saveEdit': 'Save changes',

  // Source badges on the category tag
  'transactions.tag.guessed': 'Guessed',
  'transactions.tag.guessedTitle': 'Guessed from your history',
  'transactions.tag.rule': 'Rule',
  'transactions.tag.ruleTitle': 'Categorized by a custom rule',
};
