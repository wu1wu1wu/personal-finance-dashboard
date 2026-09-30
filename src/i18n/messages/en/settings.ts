import type { settings as zhSettings } from '../zh-CN/settings';

export const settings: Record<keyof typeof zhSettings, string> = {
  'settings.title': 'Settings',
  'settings.menuLabel': 'Settings menu',

  // Settings menu
  'settings.menu.importDescription': 'CSV / XLSX bill files',
  'settings.menu.autoLedger': 'Auto-tracking',
  'settings.menu.autoLedgerDescription': 'Permissions, message rules, and diagnostics',
  'settings.menu.autoLedgerUnsupported': 'Android app only',
  'settings.menu.rulesCount_one': '{count} custom rule',
  'settings.menu.rulesCount_other': '{count} custom rules',
  'settings.menu.dataDescription_one': '{count} transaction · backup and cleanup',
  'settings.menu.dataDescription_other': '{count} transactions · backup and cleanup',
  'settings.menu.aboutDescription': 'Privacy, backups, and limitations',

  // About
  'settings.about.title': 'About',
  'settings.about.pageDescription': 'Version, where your data lives, and what the app cannot do.',
  'settings.about.appInfo': 'App info',
  'settings.about.appTitle': 'Personal Finance Dashboard v1.0',
  'settings.about.appDescription': 'Imports WeChat Pay bills and supports auto-tracking on Android.',
  'settings.about.privacy': 'Privacy',
  'settings.about.privacyBody':
    'Transactions, budgets, rules, and settings stay on this device. There is no account system and no backend, and bill contents are never uploaded.',
  'settings.about.dataBackup': 'Data and backups',
  'settings.about.dataBackupBody':
    'Before uninstalling the app, clearing its data, or switching phones, export a JSON backup from Data first.',
  'settings.about.limits': 'Limitations',
  'settings.about.limits.notification':
    'WeChat Pay notifications usually carry only the amount, with no merchant or item, so details fill in only after you import a bill.',
  'settings.about.limits.service':
    'Records are read in real time while the notification listener stays connected, so the payment notification does not have to sit in the shade.',
  'settings.about.limits.killed':
    'If the system kills the listener and the notification is deleted afterwards, Android has no way to scan that historical notification again.',
  'settings.about.limits.battery':
    'On some Chinese Android builds you need to set the battery policy to Unrestricted in the app settings so the background connection is not cut.',

  // Clean up by month
  'settings.cleanup.title': 'Clean up by month',
  'settings.cleanup.back': 'Back to settings',
  'settings.cleanup.description':
    'Check the months you want to delete. Only those transactions and their budget settings are removed; category rules and other months stay untouched.',
  'settings.cleanup.removed_one': 'Deleted {count} transaction.',
  'settings.cleanup.removed_other': 'Deleted {count} transactions.',
  'settings.cleanup.emptyTitle': 'Nothing to clean up',
  'settings.cleanup.emptyHint': 'Import a bill and the months show up here',
  'settings.cleanup.monthCount_one': '{count} month in total',
  'settings.cleanup.monthCount_other': '{count} months in total',
  'settings.cleanup.selectAll': 'Select all',
  'settings.cleanup.deselectAll': 'Deselect all',
  'settings.cleanup.monthItem_one': '{count} transaction · {amount} spent',
  'settings.cleanup.monthItem_other': '{count} transactions · {amount} spent',
  'settings.cleanup.confirm_one':
    'This deletes {count} transaction, along with the budget settings for {months} months. It cannot be undone.',
  'settings.cleanup.confirm_other':
    'This deletes {count} transactions, along with the budget settings for {months} months. It cannot be undone.',
  'settings.cleanup.confirmAction': 'Clean up',
  'settings.cleanup.action_one': 'Clean up {months} months ({count} transaction)',
  'settings.cleanup.action_other': 'Clean up {months} months ({count} transactions)',
  'settings.cleanup.undoLabel_one': 'Cleaned up {months} months · {count} transaction',
  'settings.cleanup.undoLabel_other': 'Cleaned up {months} months · {count} transactions',
};
