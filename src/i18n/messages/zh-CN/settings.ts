// 设置首页菜单 + 关于页 + 按月份清理页
// 「账单导入」「外观」「分类规则」「数据管理」的标题复用各自命名空间的 title
export const settings = {
  'settings.title': '设置',
  'settings.menuLabel': '设置菜单',

  // 设置菜单
  'settings.menu.importDescription': 'CSV / XLSX 账单文件',
  'settings.menu.autoLedger': '自动记账',
  'settings.menu.autoLedgerDescription': '权限、消息规则与诊断',
  'settings.menu.autoLedgerUnsupported': '仅安卓 App 支持',
  'settings.menu.rulesCount_one': '{count} 条自定义规则',
  'settings.menu.rulesCount_other': '{count} 条自定义规则',
  'settings.menu.dataDescription_one': '{count} 笔交易 · 备份与清理',
  'settings.menu.dataDescription_other': '{count} 笔交易 · 备份与清理',
  'settings.menu.aboutDescription': '隐私、备份和使用限制',

  // 关于
  'settings.about.title': '关于',
  'settings.about.pageDescription': '版本、数据存储方式和使用限制。',
  'settings.about.appInfo': '应用信息',
  'settings.about.appTitle': '个人记账看板 v1.0',
  'settings.about.appDescription': '支持微信支付账单导入与安卓端自动记账。',
  'settings.about.privacy': '隐私',
  'settings.about.privacyBody':
    '交易、预算、规则和设置只保存在本机。应用没有账号系统和后端服务，不会上传账单内容。',
  'settings.about.dataBackup': '数据与备份',
  'settings.about.dataBackupBody':
    '卸载应用、清除应用数据或更换手机前，请先在“数据管理”中导出 JSON 备份。',
  'settings.about.limits': '使用限制',
  'settings.about.limits.notification':
    '微信支付通知通常只包含金额，不包含商户和商品；导入账单后才能补全详情。',
  'settings.about.limits.service':
    '通知监听服务保持连接时会实时读取，不要求支付通知一直停留在通知栏。',
  'settings.about.limits.killed':
    '如果系统杀掉了监听服务，且通知随后被删除，安卓无法再补扫这条历史通知。',
  'settings.about.limits.battery':
    '部分国产系统需要在应用设置中将电池策略设为“无限制”，避免后台断连。',

  // 按月份清理
  'settings.cleanup.title': '按月份清理',
  'settings.cleanup.description':
    '勾选要删除的月份，只会清掉这些月份的交易记录和对应月份的预算设置。分类规则、其他月份的数据不受影响。',
  'settings.cleanup.removed_one': '已删除 {count} 笔交易。',
  'settings.cleanup.removed_other': '已删除 {count} 笔交易。',
  'settings.cleanup.emptyTitle': '没有可清理的数据',
  'settings.cleanup.emptyHint': '导入账单后这里会按月列出',
  'settings.cleanup.monthCount_one': '共 {count} 个月',
  'settings.cleanup.monthCount_other': '共 {count} 个月',
  'settings.cleanup.selectAll': '全选',
  'settings.cleanup.deselectAll': '取消全选',
  'settings.cleanup.monthItem_one': '{count} 笔 · 支出 {amount}',
  'settings.cleanup.monthItem_other': '{count} 笔 · 支出 {amount}',
  'settings.cleanup.confirm_one': '将删除 {count} 笔交易和 {months} 个月的预算设置，此操作不可撤销。',
  'settings.cleanup.confirm_other':
    '将删除 {count} 笔交易和 {months} 个月的预算设置，此操作不可撤销。',
  'settings.cleanup.confirmAction': '确认清理',
  'settings.cleanup.action_one': '清理所选 {months} 个月（共 {count} 笔）',
  'settings.cleanup.action_other': '清理所选 {months} 个月（共 {count} 笔）',
  'settings.cleanup.undoLabel_one': '已清理 {months} 个月，共 {count} 笔',
  'settings.cleanup.undoLabel_other': '已清理 {months} 个月，共 {count} 笔',
} as const;
