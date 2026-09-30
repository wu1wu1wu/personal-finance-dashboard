// 明细页及其组件（列表行 / 详情弹窗 / 手动记一笔 / 分类标签 / 主题卡片）的文案
export const transactions = {
  'transactions.title': '交易明细',

  // 筛选与排序
  'transactions.directionGroup': '收支方向',
  'transactions.sort.label': '排序方式',
  'transactions.sort.timeDesc': '时间：新 → 旧',
  'transactions.sort.timeAsc': '时间：旧 → 新',
  'transactions.sort.amountDesc': '金额：大 → 小',
  'transactions.sort.amountAsc': '金额：小 → 大',
  'transactions.searchLabel': '搜索交易对方或商品说明',
  'transactions.searchPlaceholder': '搜索交易对方或商品说明…',
  'transactions.minAmount': '最小金额',
  'transactions.maxAmount': '最大金额',
  'transactions.amountTo': '至',
  'transactions.clearAmountFilter': '清除金额筛选',
  'transactions.month.groupLabel': '选择月份',
  'transactions.month.all': '全部月份',
  'transactions.categoryFilterPrefix': '筛选分类：',
  'transactions.pendingInboxPrefix': '待确认收件箱：',
  'transactions.clearCategoryFilter': '清除分类筛选',
  'transactions.exitInbox': '退出收件箱',

  // 汇总 / 重跑分类
  'transactions.summaryCount_one': '共 {count} 笔',
  'transactions.summaryCount_other': '共 {count} 笔',
  'transactions.summary.expense': '支出: {amount}',
  'transactions.summary.income': '收入: {amount}',
  'transactions.summary.transfer': '转账: {amount}',
  'transactions.reclassify': '重新识别',
  'transactions.reclassify.done_one': '已重新归类 1 笔',
  'transactions.reclassify.done_other': '已重新归类 {count} 笔',
  'transactions.reclassify.empty': '没有可以自动归类的记录',

  // 批量归类
  'transactions.batch.enter': '批量归类',
  'transactions.batch.selected_one': '已选 1 笔',
  'transactions.batch.selected_other': '已选 {count} 笔',
  'transactions.batch.setCategory': '设为分类',
  'transactions.deleted_one': '已删除 1 笔交易',
  'transactions.deleted_other': '已删除 {count} 笔交易',

  // 空状态
  'transactions.empty.title': '还没有交易记录',
  'transactions.empty.hint':
    '到「设置」导入微信账单，或点底部（桌面端在右上角）的「记一笔」',
  'transactions.emptyFiltered.title': '没有符合筛选的交易',
  'transactions.emptyFiltered.action': '清除全部筛选条件',

  // 列表行 / 卡片
  'transactions.unknown': '未知交易',
  'transactions.thisTransaction': '这笔交易',
  'transactions.viewDetail': '查看 {name} 的详情',
  'transactions.selectItem': '选择 {name}',
  'transactions.deleteNamed': '删除 {name}',
  'transactions.confirmDelete': '确认删除',
  'transactions.overLimit': '超过单笔上限 {amount}',
  'transactions.untitled': '未命名',
  'transactions.removeTheme': '移除主题',

  // 记一笔
  'transactions.add.title': '记一笔',
  'transactions.add.description': '金额和交易对方是必填项',
  'transactions.add.amountLabel': '金额（元）',
  'transactions.add.counterpartyPlaceholder': '如：美团外卖',

  // 字段名
  'transactions.field.transactionTime': '交易时间',
  'transactions.field.transactionType': '收支类型',
  'transactions.field.counterparty': '交易对方',
  'transactions.field.itemDescription': '商品说明',
  'transactions.field.note': '备注',
  'transactions.field.paymentMethod': '支付方式',
  'transactions.field.paymentStatus': '交易状态',
  'transactions.field.transactionNo': '交易单号',
  'transactions.field.categorySource': '分类来源',
  'transactions.field.periodic': '周期交易',
  'transactions.field.importedAt': '导入时间',
  'transactions.field.theme': '主题',
  'transactions.field.tags': '标签',
  'transactions.field.date': '日期',

  // 分类来源 / 布尔
  'transactions.source.manual': '手动指定',
  'transactions.source.rule': '自定义规则',
  'transactions.source.guessed': '习惯推测',
  'transactions.source.auto': '自动识别',
  'transactions.yes': '是',
  'transactions.no': '否',

  // 详情弹窗
  'transactions.deleteThis': '删除这笔交易',
  'transactions.detail.overLimit':
    '这笔 {amount} 超过了「{category}」的单笔上限 {limit}，超出 {excess}。',
  'transactions.detail.themePlaceholder': '给这笔账单写个主题，如：和朋友的晚餐',
  'transactions.detail.themeHint': '设了主题的账单会出现在看板的「主题」视图里',
  'transactions.detail.coverAlt': '账单配图',
  'transactions.detail.uploading': '上传中…',
  'transactions.detail.replaceCover': '更换配图',
  'transactions.detail.addCover': '添加配图',
  'transactions.detail.removeCover': '移除',
  'transactions.detail.quickCategorize': '快速归类',
  'transactions.detail.section': '明细',
  'transactions.detail.editHint': '编辑过的记录不会再被后续导入的账单覆盖。',
  'transactions.detail.saveEdit': '保存修改',

  // 分类标签上的来源角标
  'transactions.tag.guessed': '推测',
  'transactions.tag.guessedTitle': '按历史习惯推测',
  'transactions.tag.rule': '规则',
  'transactions.tag.ruleTitle': '按自定义消息规则归类',
} as const;
