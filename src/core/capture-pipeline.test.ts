import { describe, it, expect } from 'vitest';
import type { Transaction } from '@/types';
import { parseCapturedTransaction } from './transaction-capture';
import { resolveCaptureTiming } from './capture-timing';
import { buildClassifyContext } from './classify-context';
import { classifyTransactionDetailed } from './classify';
import { generateTransactionId } from '@/utils/id';

/**
 * 自动记账的 JS 全链路：通知原文 → 解析 → 分类。
 *
 * 这条组合原本没有测试覆盖，而这正是「能不能自动记账」最关键的一段：
 * 只要这段能跑出合法交易，收不到消息就一定是原生层（通知使用权 / 监听服务）的问题，
 * 与分类重构无关。
 */
function runCapture(text: string, packageName: string, timestamp: number, history: Transaction[] = []) {
  const parsed = parseCapturedTransaction(text, { packageName, rules: [], settings: undefined });
  if (!parsed) return null;

  const timing = resolveCaptureTiming({
    text,
    package: packageName,
    timestamp,
    fingerprint: 'fp',
  } as never);

  const txn: Transaction = {
    id: generateTransactionId(timing.transactionTime, parsed.amount, timing.transactionNo),
    transactionTime: timing.transactionTime,
    transactionType: parsed.transactionType,
    counterparty: parsed.counterparty,
    description: parsed.description,
    amount: parsed.amount,
    paymentStatus: '',
    transactionNo: timing.transactionNo,
    paymentMethod: '',
    category: '',
    categorySource: 'auto',
    origin: 'auto',
    isPeriodic: false,
    tags: [],
    createdAt: new Date(timing.capturedAt).toISOString(),
    coverImage: '',
    theme: '',
  };

  const ctx = buildClassifyContext(history, []);
  const verdict = classifyTransactionDetailed(txn, ctx);
  return { txn, verdict };
}

const WE_CHAT = 'com.tencent.mm';

describe('微信支付通知 → 解析 → 分类', () => {
  it('只有金额的通知能解析成一笔支出，分类老实留白', () => {
    const r = runCapture('微信支付: 已支付¥22.30', WE_CHAT, 1760000000000);
    expect(r).not.toBeNull();
    expect(r!.txn.amount).toBe(22.3);
    expect(r!.txn.transactionType).toBe('支出');
    expect(r!.verdict.category).toBe('待确认');
    expect(r!.verdict.level).toBe('pending');
  });

  it('有历史消费习惯时，同一笔会得到标明依据的「推测」', () => {
    const history: Transaction[] = Array.from({ length: 6 }, (_, i) => ({
      id: `h${i}`,
      transactionTime: `2026-09-0${i + 1} 12:0${i}:00`,
      transactionType: '支出',
      counterparty: '某店',
      description: '',
      amount: 22,
      paymentStatus: '',
      transactionNo: `N${i}`,
      paymentMethod: '',
      category: '餐饮美食',
      categorySource: 'manual',
      origin: 'import',
      isPeriodic: false,
      tags: [],
      createdAt: '2026-09-01T04:00:00.000Z',
      coverImage: '',
      theme: '',
    }));
    // 12:00 落在历史归纳出的时段金额区间内
    const at = new Date('2026-10-18T12:00:00').getTime();
    const r = runCapture('微信支付: 已支付¥22.30', WE_CHAT, at, history);
    expect(r!.verdict.level).toBe('guessed');
    expect(r!.verdict.basis).toBe('amount-time');
  });
});

describe('带商户名的通知 → 解析 → 分类', () => {
  it('美团外卖通知按店名判成餐饮，而不是被渠道词吞掉', () => {
    const r = runCapture('美团: 塔斯汀·中国汉堡(武汉宁康路店) 已支付¥23.90', WE_CHAT, 1760000000000);
    expect(r).not.toBeNull();
    expect(r!.verdict.category).toBe('餐饮美食');
    expect(r!.verdict.level).toBe('certain');
  });
});
