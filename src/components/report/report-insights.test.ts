import { describe, expect, it } from 'vitest';
import { buildMonthlyReport } from '@/core/report-engine';
import type { Transaction } from '@/types';
import { buildReportInsights } from './report-insights';
import type { ReportInsight } from './report-insights';

/** 造一笔交易（默认支出） */
function txn(
  time: string,
  amount: number,
  overrides: Partial<Transaction> = {},
): Transaction {
  return {
    id: `${time}-${amount}-${overrides.counterparty ?? '商户'}`,
    transactionTime: time,
    transactionType: amount < 0 ? '收入' : '支出',
    counterparty: '商户',
    description: '',
    amount,
    paymentStatus: '支付成功',
    transactionNo: `NO-${time}-${amount}`,
    paymentMethod: '零钱',
    category: '餐饮美食',
    categorySource: 'rule',
    origin: 'import',
    isPeriodic: false,
    tags: [],
    createdAt: '2026-09-30T00:00:00.000Z',
    coverImage: '',
    theme: '',
    ...overrides,
  };
}

function reportFor(transactions: Transaction[], month = '2026-09', totalBudgets?: Record<string, number>) {
  return buildMonthlyReport({ transactions, month, totalBudgets, today: '2026-09-30' });
}

const keys = (insights: ReportInsight[]): string[] => insights.map((i) => i.key);

describe('buildReportInsights', () => {
  it('空月份不产出任何要点', () => {
    expect(buildReportInsights(reportFor([]), 'zh-CN')).toEqual([]);
  });

  it('支出变多时说「多了多少」并给出差额', () => {
    const txs = [txn('2026-08-10 12:00:00', 100), txn('2026-09-10 12:00:00', 300)];

    const insights = buildReportInsights(reportFor(txs), 'zh-CN');
    const up = insights.find((i) => i.key === 'report.insight.expenseUp');

    expect(up).toBeDefined();
    expect(up?.params?.percent).toBe(200);
    expect(up?.params?.amount).toBe('200.00元');
  });

  it('支出变少时说「少了多少」', () => {
    const txs = [txn('2026-08-10 12:00:00', 300), txn('2026-09-10 12:00:00', 150)];

    const down = buildReportInsights(reportFor(txs), 'zh-CN').find(
      (i) => i.key === 'report.insight.expenseDown',
    );

    expect(down?.params?.percent).toBe(50);
    expect(down?.params?.amount).toBe('150.00元');
  });

  it('环比几乎没变时说持平', () => {
    const txs = [txn('2026-08-10 12:00:00', 1000), txn('2026-09-10 12:00:00', 1003)];

    expect(keys(buildReportInsights(reportFor(txs), 'zh-CN'))).toContain(
      'report.insight.expenseFlat',
    );
  });

  it('上月没有支出时不硬讲环比，其他要点照常', () => {
    const insights = buildReportInsights(reportFor([txn('2026-09-10 12:00:00', 300)]), 'zh-CN');
    const result = keys(insights);

    expect(result).not.toContain('report.insight.expenseUp');
    expect(result).not.toContain('report.insight.expenseDown');
    expect(result).not.toContain('report.insight.expenseFlat');
    expect(result).toContain('report.insight.topCategory');
    expect(result).toContain('report.insight.dailyAverage');
  });

  it('分类名按语言本地化', () => {
    const txs = [
      txn('2026-09-10 12:00:00', 300, { category: '交通出行' }),
    ];

    const zh = buildReportInsights(reportFor(txs), 'zh-CN').find(
      (i) => i.key === 'report.insight.topCategory',
    );
    const en = buildReportInsights(reportFor(txs), 'en').find(
      (i) => i.key === 'report.insight.topCategory',
    );

    expect(zh?.params?.category).toBe('交通出行');
    expect(en?.params?.category).toBe('Transport');
  });

  it('最大一笔没商户名时退回商品说明，不能出现空名字', () => {
    const txs = [
      txn('2026-09-10 12:00:00', 900, { counterparty: '', description: '快件畅存费' }),
      txn('2026-09-11 12:00:00', 10),
    ];

    const largest = buildReportInsights(reportFor(txs), 'zh-CN').find(
      (i) => i.key === 'report.insight.largest',
    );

    expect(largest?.params?.name).toBe('快件畅存费');
  });

  it('有待确认分类时必须提醒', () => {
    const txs = [txn('2026-09-10 12:00:00', 10, { category: '' })];
    const insights = reportFor(txs);

    expect(insights.pendingCount).toBe(1);
    expect(keys(buildReportInsights(insights, 'zh-CN'))).toContain('report.insight.pending');
  });

  it('分类都确认过时不出现待确认提醒', () => {
    const txs = [txn('2026-09-10 12:00:00', 10)];
    expect(keys(buildReportInsights(reportFor(txs), 'zh-CN'))).not.toContain(
      'report.insight.pending',
    );
  });

  it('预算接近上限与超支分别给不同文案，正常时不占位', () => {
    const txs = [txn('2026-09-10 12:00:00', 850)];

    const near = keys(buildReportInsights(reportFor(txs, '2026-09', { '2026-09': 1000 }), 'zh-CN'));
    expect(near).toContain('report.insight.budgetNear');
    expect(near).not.toContain('report.insight.budgetOver');

    const over = keys(buildReportInsights(reportFor(txs, '2026-09', { '2026-09': 500 }), 'zh-CN'));
    expect(over).toContain('report.insight.budgetOver');

    const ok = keys(buildReportInsights(reportFor(txs, '2026-09', { '2026-09': 5000 }), 'zh-CN'));
    expect(ok).not.toContain('report.insight.budgetNear');
    expect(ok).not.toContain('report.insight.budgetOver');
  });

  it('周期扣款要点带上笔数与合计', () => {
    const txs = [
      txn('2026-07-05 08:00:00', 25, { counterparty: '视频会员', isPeriodic: true }),
      txn('2026-08-05 08:00:00', 25, { counterparty: '视频会员', isPeriodic: true }),
      txn('2026-09-05 08:00:00', 25, { counterparty: '视频会员', isPeriodic: true }),
    ];

    const periodic = buildReportInsights(reportFor(txs), 'zh-CN').find(
      (i) => i.key === 'report.insight.periodic',
    );

    expect(periodic?.params?.count).toBe(1);
    expect(periodic?.params?.amount).toBe('25.00元');
  });

  it('顺序稳定：先讲钱，再讲待确认与预算', () => {
    const txs = [
      txn('2026-08-10 12:00:00', 100),
      txn('2026-09-10 12:00:00', 900, { category: '' }),
    ];

    const result = keys(buildReportInsights(reportFor(txs, '2026-09', { '2026-09': 500 }), 'zh-CN'));

    expect(result.indexOf('report.insight.expenseUp')).toBeLessThan(
      result.indexOf('report.insight.dailyAverage'),
    );
    expect(result.indexOf('report.insight.topCategory')).toBeLessThan(
      result.indexOf('report.insight.pending'),
    );
    expect(result.indexOf('report.insight.pending')).toBeLessThan(
      result.indexOf('report.insight.budgetOver'),
    );
  });
});
