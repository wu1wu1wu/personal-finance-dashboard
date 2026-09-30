// 数据管理页（导出/恢复/最近删除/脱敏/清空）
export const settingsData = {
  'settingsData.title': '数据管理',
  'settingsData.description': '查看数据规模、导出备份，或按月份清理交易记录。',
  // 一行里多个片段的连接符（日期 · 笔数 · 原因），和 billImport.done.separator 同理
  'settingsData.separator': ' · ',

  'settingsData.stats.title': '数据统计',
  'settingsData.stats.transactions': '交易记录',
  'settingsData.stats.customRules': '自定义规则',
  'settingsData.stats.budgets': '分类预算',
  'settingsData.stats.budgetMonths': '预算月份',

  'settingsData.privacy.title': '隐私',
  'settingsData.privacy.maskLabel': '导入账单时脱敏',
  'settingsData.privacy.maskHint':
    '把银行卡号、手机号、交易单号打码后再存进本机。关掉后保留原始内容，方便按单号对账。',

  'settingsData.backup.title': '数据备份与恢复',
  'settingsData.backup.description':
    '所有数据只存在本机，不会发送到任何服务器。换机或清缓存前建议先导出备份。',
  'settingsData.backup.exportMasked': '导出备份（已脱敏）',
  'settingsData.backup.exportFull': '导出完整备份',
  'settingsData.backup.restoreLabel': '恢复备份',
  'settingsData.backup.note':
    '完整备份含短信/通知原文，请自行妥善保管；恢复前会自动把当前数据存成一份快照。',
  // 下载文件名
  'settingsData.backup.fileNameMasked': '记账备份_已脱敏',
  'settingsData.backup.fileNameFull': '记账备份_完整',
  'settingsData.backup.confirmMessage_one':
    '将用「{fileName}」覆盖本机的 1 项数据（交易、规则、预算、设置）。当前数据会先存一份快照。',
  'settingsData.backup.confirmMessage_other':
    '将用「{fileName}」覆盖本机的 {count} 项数据（交易、规则、预算、设置）。当前数据会先存一份快照。',
  'settingsData.backup.confirmRestore': '确认恢复',

  'settingsData.export.inProgress': '正在导出…',
  'settingsData.export.masked': '已导出（银行卡号、手机号、单号已打码）',
  'settingsData.export.full': '已导出完整备份（含原始文本）',
  'settingsData.export.failed': '导出失败：{message}',

  'settingsData.error.unknown': '未知错误',

  'settingsData.restore.invalid': '备份文件不可用：{error}',
  'settingsData.restore.invalidJson': '备份文件不可用：不是合法的 JSON 文件',
  'settingsData.restore.inProgress': '正在恢复…',
  'settingsData.restore.success_one': '恢复成功，已还原 1 项数据，页面即将刷新…',
  'settingsData.restore.success_other': '恢复成功，已还原 {count} 项数据，页面即将刷新…',
  'settingsData.restore.failed': '恢复失败：{error}（本机数据已保留原样）',
  'settingsData.restore.failedUnexpected': '恢复失败：{message}',

  'settingsData.trash.title': '最近删除',
  'settingsData.trash.description':
    '删除的交易会在这里保留 30 天（最多 20 批、500 笔），可以随时恢复；封面图也一并保留。',
  'settingsData.trash.empty': '没有可恢复的内容',
  'settingsData.trash.reasonMonths': '按月清理',
  'settingsData.trash.reasonSingle': '单笔删除',
  'settingsData.trash.restored_one': '已恢复 1 笔交易',
  'settingsData.trash.restored_other': '已恢复 {count} 笔交易',
  'settingsData.trash.clearTrash': '清空最近删除',
  'settingsData.trash.cleared': '已清空最近删除',

  'settingsData.cleanup.title': '清理数据',
  'settingsData.cleanup.byMonth.title': '按月份清理',
  'settingsData.cleanup.byMonth.description': '选择要删除的月份，只清掉那几个月的数据',
  'settingsData.cleanup.byMonth.action': '选择月份清理',
  'settingsData.cleanup.all.title': '清除所有数据',
  'settingsData.cleanup.all.description':
    '清掉本机全部数据：交易记录、封面图、分类规则与反馈、预算，以及自动记账的读取规则与捕获队列（含尚未处理的通知/短信原文）。此操作不可撤销，建议先导出备份。',
  'settingsData.cleanup.all.exportFirst': '先导出一份备份',
  'settingsData.cleanup.all.confirm': '确定要清除所有数据吗？此操作不可撤销。',
  'settingsData.cleanup.all.confirmAction': '确认清除',
} as const;
