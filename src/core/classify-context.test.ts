// src/core/classify-context.test.ts
import { describe, it, expect } from 'vitest';
import type { ClassificationRule, Transaction } from '@/types';
import { buildClassifyContext } from './classify-context';

function txn(partial: Partial<Transaction>): Transaction {
  return {
    id: partial.id ?? 'x',
    transactionTime: '2026-09-01 12:00:00',
    transactionType: '支出',
    counterparty: '',
    description: '',
    amount: 20,
    paymentStatus: '',
    transactionNo: '',
    paymentMethod: '',
    category: '待确认',
    categorySource: 'auto',
    origin: 'import',
    isPeriodic: false,
    tags: [],
    createdAt: '2026-09-01 12:00:00',
    coverImage: '',
    theme: '',
    ...partial,
  };
}

describe('buildClassifyContext', () => {
  it('用已确认记录构建记忆与时段金额规则', () => {
    const txns = Array.from({ length: 6 }, (_, i) =>
      txn({ id: `m${i}`, counterparty: '塔斯汀', amount: 22, category: '餐饮美食', categorySource: 'manual' }),
    );
    const ctx = buildClassifyContext(txns, [] as ClassificationRule[]);
    expect(ctx.memory?.size).toBeGreaterThan(0);
    expect(ctx.amountTimeRules?.length).toBeGreaterThan(0);
  });

  it('渠道统计只统计已确认记录', () => {
    const txns = [
      txn({ id: 'a', counterparty: '美团', category: '餐饮美食', categorySource: 'manual' }),
      txn({ id: 'b', counterparty: '美团', category: '餐饮美食', categorySource: 'manual' }),
      txn({ id: 'c', counterparty: '美团', category: '餐饮美食', categorySource: 'manual' }),
      txn({ id: 'd', counterparty: '美团', category: '交通出行', categorySource: 'guessed' }),
    ];
    const ctx = buildClassifyContext(txns, []);
    expect(ctx.channelStats?.get('美团')?.get('餐饮美食')).toBe(3);
    expect(ctx.channelStats?.get('美团')?.get('交通出行')).toBeUndefined();
  });
});
