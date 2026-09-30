import type { settingsRules as zhSettingsRules } from '../zh-CN/settingsRules';

export const settingsRules: Record<keyof typeof zhSettingsRules, string> = {
  'settingsRules.title': 'Category rules',
  'settingsRules.description':
    'Transactions that match a keyword are filed under the category you choose.',
  'settingsRules.addRule': 'Add rule',
  'settingsRules.saveChanges': 'Save changes',
  'settingsRules.rulesEmpty': 'No custom rules yet',
  'settingsRules.separator': ' · ',

  'settingsRules.categoryRule.hint':
    'Keywords that match a custom rule are categorised your way first',
  'settingsRules.categoryRule.keywordsLabel': 'Keywords (separate with commas or spaces)',
  'settingsRules.categoryRule.keywordsPlaceholder': 'e.g. Starbucks, Luckin, Manner',
  'settingsRules.categoryRule.targetCategory': 'Target category',
  'settingsRules.categoryRule.emptyHint':
    'Add keywords and any transaction containing them goes straight to the category you pick',
  'settingsRules.categoryRule.editAria': 'Edit rule {name}',
  'settingsRules.categoryRule.deleteAria': 'Delete rule {name}',
  'settingsRules.categoryRule.builtinTitle_one': 'View built-in category rules (1 category)',
  'settingsRules.categoryRule.builtinTitle_other':
    'View built-in category rules ({count} categories)',

  'settingsRules.autoLedger.title': 'Auto-ledger',
  'settingsRules.autoLedger.description':
    'Manage notification and SMS permissions, check capture status and configure how messages are recognised.',
  'settingsRules.autoLedger.androidOnly':
    'Auto-ledger is only available in the Android app — install the packaged app to use it.',
  'settingsRules.autoLedger.granted': 'On',
  'settingsRules.autoLedger.notGranted': 'Off',
  'settingsRules.autoLedger.permission.title': 'Permissions',
  'settingsRules.autoLedger.permission.sms': 'SMS permission',
  'settingsRules.autoLedger.permission.smsHint': 'Read bank transaction texts',
  'settingsRules.autoLedger.permission.notification': 'Notification access',
  'settingsRules.autoLedger.permission.notificationHint':
    'Read WeChat, Alipay and bank notifications',
  'settingsRules.autoLedger.permission.smsAction': 'Grant',
  'settingsRules.autoLedger.permission.notificationAction': 'Enable',
  'settingsRules.autoLedger.notificationNote':
    'While the notification listener stays connected, messages are read in real time — payment notifications do not have to stay in the shade. Only a catch-up scan after the service drops relies on messages still sitting in the notification shade.',
  'settingsRules.autoLedger.battery.title': 'Background running',
  'settingsRules.autoLedger.battery.policy': 'Battery policy',
  'settingsRules.autoLedger.battery.checking': 'Checking…',
  'settingsRules.autoLedger.battery.allowed': 'Allowed to keep running in the background',
  'settingsRules.autoLedger.battery.recommend':
    'Set it to "Unrestricted" so the system stops dropping the connection',
  'settingsRules.autoLedger.battery.openSettings': 'Open settings',
  'settingsRules.autoLedger.captureRules.title': 'Message reading rules',
  'settingsRules.autoLedger.diagnostics.title': 'Diagnostics',
  'settingsRules.autoLedger.diagnostics.connection': 'Notification listener connection',
  'settingsRules.autoLedger.diagnostics.checking': 'Checking…',
  'settingsRules.autoLedger.diagnostics.connected': 'Connected',
  'settingsRules.autoLedger.diagnostics.disconnected': 'Disconnected',
  'settingsRules.autoLedger.diagnostics.lastConnected': 'Last connected: {time}',
  'settingsRules.autoLedger.diagnostics.lastNotification': 'Last notification: {time}',
  'settingsRules.autoLedger.diagnostics.wechatLastSeen': 'WeChat last seen: {time}',
  'settingsRules.autoLedger.diagnostics.lastTransaction': 'Last transaction recognised: {time}',
  'settingsRules.autoLedger.diagnostics.queueSize_one': 'Pending queue: {count} message',
  'settingsRules.autoLedger.diagnostics.queueSize_other': 'Pending queue: {count} messages',
  'settingsRules.autoLedger.diagnostics.filtered_one':
    'Filtered out non-transaction notifications: {count}',
  'settingsRules.autoLedger.diagnostics.filtered_other':
    'Filtered out non-transaction notifications: {count}',
  'settingsRules.autoLedger.diagnostics.rescan': 'Rescan notification shade',
  'settingsRules.autoLedger.diagnostics.refresh': 'Refresh',
  'settingsRules.autoLedger.diagnostics.clear': 'Clear diagnostics',
  'settingsRules.autoLedger.diagnostics.recent_one':
    'Most recent transaction notification recognised',
  'settingsRules.autoLedger.diagnostics.recent_other':
    'Most recent {count} transaction notifications recognised',
  'settingsRules.autoLedger.time.empty': 'None yet',
  'settingsRules.autoLedger.time.capturedAt': 'Captured by the app at {time}',
  'settingsRules.autoLedger.recognized': 'Recognised ¥{amount}',
  'settingsRules.autoLedger.parseFailed': 'Passed the transaction filter · parsing failed',

  'settingsRules.captureRule.hint':
    'Add your own rule for a bank or app the built-in rules do not cover',
  'settingsRules.captureRule.emptyHint':
    'If a bank notification you keep getting cannot be read, add a rule for it',
  'settingsRules.captureRule.disableAria': 'Disable rule {name}',
  'settingsRules.captureRule.enableAria': 'Enable rule {name}',
  'settingsRules.captureRule.editAria': 'Edit rule {name}',
  'settingsRules.captureRule.deleteAria': 'Delete rule {name}',
  'settingsRules.captureRule.asIncome': 'Record as income',
  'settingsRules.captureRule.asExpense': 'Record as spending',
  'settingsRules.captureRule.withCategory': 'filed under {category}',
  'settingsRules.captureRule.withContains': 'contains "{keywords}"',
  'settingsRules.captureRule.withPackage': 'from {packageMatch}',
  'settingsRules.captureRule.name': 'Rule name',
  'settingsRules.captureRule.namePlaceholder': 'e.g. CMB SMS',
  'settingsRules.captureRule.contains': 'Message contains (any match counts, separate with commas)',
  'settingsRules.captureRule.containsPlaceholder': 'e.g. CMB, card ending 1234',
  'settingsRules.captureRule.excludes': 'Ignore if it contains (optional)',
  'settingsRules.captureRule.excludesPlaceholder': 'e.g. pending payment, verification code',
  'settingsRules.captureRule.amountRegex': 'Amount regex (optional, the first group is the amount)',
  'settingsRules.captureRule.amountRegexPlaceholder': 'e.g. amount=([\\d,.]+)',
  'settingsRules.captureRule.amountRegexHint':
    'Leave it empty to use the built-in ¥ / 元 / 人民币 extraction',
  'settingsRules.captureRule.direction': 'Direction',
  'settingsRules.captureRule.category': 'Category (optional)',
  'settingsRules.captureRule.autoCategory': 'Let auto-categorisation decide',
  'settingsRules.captureRule.packageMatch': 'Limit to a source app (optional)',
  'settingsRules.captureRule.packageName': 'Source package name',
  'settingsRules.captureRule.packagePlaceholder': 'e.g. com.icbc',
  'settingsRules.captureRule.packageHint': 'Package names are listed in the diagnostics above',
  'settingsRules.captureRule.testTitle': 'Paste a message and try it',
  'settingsRules.captureRule.testTextLabel': 'Test message text',
  'settingsRules.captureRule.testPlaceholder':
    'Paste the raw SMS or notification you received on your phone here…',
  'settingsRules.captureRule.testPackagePlaceholder':
    'Source package name (optional), e.g. com.tencent.mm',
  'settingsRules.captureRule.testMatch': 'Will be recorded as {type}: {amount}',
  'settingsRules.captureRule.testRuleHit': 'Matched rule "{name}"',
  'settingsRules.captureRule.testBuiltin': 'Using built-in rules',
  'settingsRules.captureRule.testCategory': 'categorised as {category}',
  'settingsRules.captureRule.testCounterparty': 'counterparty {counterparty}',
  'settingsRules.captureRule.testNoMatch': 'This message will not be recorded',
  'settingsRules.captureRule.globalIgnore': 'Global ignores',
  'settingsRules.captureRule.ignorePackages':
    'Ignore these source apps (package names, comma separated)',
  'settingsRules.captureRule.ignorePackagesPlaceholder': 'e.g. com.tencent.qqmusic',
  'settingsRules.captureRule.ignoreKeywords': 'Ignore messages containing these words',
  'settingsRules.captureRule.ignoreKeywordsPlaceholder':
    'e.g. membership renewal, points reminder',
  'settingsRules.captureRule.ignoreNote':
    'Reminder phrases such as 待支付, 未支付 and 应缴 are already blocked by default — no need to add them again',
  'settingsRules.captureRule.testCategoryResult':
    'The test result will be filed under "{category}"',
};
