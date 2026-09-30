import type { settingsData as zhSettingsData } from '../zh-CN/settingsData';

export const settingsData: Record<keyof typeof zhSettingsData, string> = {
  'settingsData.title': 'Data',
  'settingsData.description':
    'See how much data you have, export a backup, or clean up transactions by month.',
  'settingsData.separator': ' · ',

  'settingsData.stats.title': 'Data overview',
  'settingsData.stats.transactions': 'Transactions',
  'settingsData.stats.customRules': 'Custom rules',
  'settingsData.stats.budgets': 'Category budgets',
  'settingsData.stats.budgetMonths': 'Budget months',

  'settingsData.privacy.title': 'Privacy',
  'settingsData.privacy.maskLabel': 'Mask data when importing bills',
  'settingsData.privacy.maskHint':
    'Card numbers, phone numbers and order numbers are masked before they are saved on this device. Turn it off to keep the original text, which makes it easier to reconcile by order number.',

  'settingsData.backup.title': 'Backup & restore',
  'settingsData.backup.description':
    'Everything stays on this device and is never sent to a server. Export a backup before switching phones or clearing the cache.',
  'settingsData.backup.exportMasked': 'Export masked backup',
  'settingsData.backup.exportFull': 'Export full backup',
  'settingsData.backup.restoreLabel': 'Restore backup',
  'settingsData.backup.note':
    'The full backup contains raw SMS and notification text — keep it safe. Your current data is snapshotted automatically before a restore.',
  'settingsData.backup.fileNameMasked': 'ledger-backup-masked',
  'settingsData.backup.fileNameFull': 'ledger-backup-full',
  'settingsData.backup.confirmMessage_one':
    'This will replace 1 local data set with "{fileName}" (transactions, rules, budgets, settings). The current data is snapshotted first.',
  'settingsData.backup.confirmMessage_other':
    'This will replace {count} local data sets with "{fileName}" (transactions, rules, budgets, settings). The current data is snapshotted first.',
  'settingsData.backup.confirmRestore': 'Confirm restore',

  'settingsData.export.inProgress': 'Exporting…',
  'settingsData.export.masked': 'Exported (card, phone and order numbers masked)',
  'settingsData.export.full': 'Full backup exported (raw text included)',
  'settingsData.export.failed': 'Export failed: {message}',

  'settingsData.error.unknown': 'Unknown error',

  'settingsData.restore.invalid': 'Backup file unusable: {error}',
  'settingsData.restore.invalidJson': 'Backup file unusable: not a valid JSON file',
  'settingsData.restore.inProgress': 'Restoring…',
  'settingsData.restore.success_one':
    'Restore complete — 1 data set restored. The page will refresh shortly…',
  'settingsData.restore.success_other':
    'Restore complete — {count} data sets restored. The page will refresh shortly…',
  'settingsData.restore.failed': 'Restore failed: {error} (your local data was left as it was)',
  'settingsData.restore.failedUnexpected': 'Restore failed: {message}',

  'settingsData.trash.title': 'Recently deleted',
  'settingsData.trash.description':
    'Deleted transactions stay here for 30 days (up to 20 batches / 500 transactions) and can be restored at any time; cover images are kept too.',
  'settingsData.trash.empty': 'Nothing to restore',
  'settingsData.trash.reasonMonths': 'Cleaned up by month',
  'settingsData.trash.reasonSingle': 'Deleted individually',
  'settingsData.trash.restored_one': 'Restored 1 transaction',
  'settingsData.trash.restored_other': 'Restored {count} transactions',
  'settingsData.trash.clearTrash': 'Empty recently deleted',
  'settingsData.trash.cleared': 'Recently deleted emptied',

  'settingsData.cleanup.title': 'Clean up data',
  'settingsData.cleanup.byMonth.title': 'Clean up by month',
  'settingsData.cleanup.byMonth.description':
    'Choose the months to delete — only those months are removed',
  'settingsData.cleanup.byMonth.action': 'Choose months to clean',
  'settingsData.cleanup.all.title': 'Erase all data',
  'settingsData.cleanup.all.description':
    'Erases everything on this device: transactions, cover images, category rules and feedback, budgets, and the auto-ledger capture rules and capture queue (including unprocessed SMS and notification text). This cannot be undone — export a backup first.',
  'settingsData.cleanup.all.exportFirst': 'Export a backup first',
  'settingsData.cleanup.all.confirm': 'Erase all data? This cannot be undone.',
  'settingsData.cleanup.all.confirmAction': 'Erase everything',
};
