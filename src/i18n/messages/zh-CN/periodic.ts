// 周期交易列表与固定/弹性开销图（看板「更多分析」里那块）
export const periodic = {
  'periodic.title': '周期交易',
  'periodic.listTitle': '周期性交易',
  'periodic.emptyTitle': '暂未检测到周期性交易',
  'periodic.emptyHint': '连续 3 个月以上相同金额的支出会被自动识别',
  // 前面的数字由列表标题旁渲染，这里只接后半句
  'periodic.detected_one': '检测到 1 项',
  'periodic.detected_other': '检测到 {count} 项',
  'periodic.unknownCounterparty': '未知',
  'periodic.nextExpected': '下次预计 {date}',
  'periodic.lastSeen': '最近 {date}',
  'periodic.unmark': '取消标记 {name} 为周期交易',
  'periodic.period.monthly': '月度',
  'periodic.period.quarterly': '季度',
  'periodic.period.yearly': '年度',
  'periodic.breakdownTitle': '固定 vs 弹性',
  'periodic.noExpenseThisMonth': '本月暂无支出数据',
} as const;
