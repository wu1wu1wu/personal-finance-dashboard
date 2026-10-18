// src/core/merchant-memory.test.ts
import { describe, it, expect } from 'vitest';
import type { Transaction } from '@/types';
import { buildMerchantMemory, lookupMerchantMemory } from './merchant-memory';
import { extractMerchantKey } from './merchant-key';

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

describe('buildMerchantMemory', () => {
  it('从用户手设的记录学', () => {
    const memory = buildMerchantMemory([txn({ counterparty: '塔斯汀', category: '餐饮美食', categorySource: 'manual' })]);
    expect(lookupMerchantMemory(memory, '塔斯汀')).toEqual({ category: '餐饮美食' });
  });

  it('从关键词命中的记录学（店名可识别时）', () => {
    const memory = buildMerchantMemory([
      txn({ counterparty: '肯德基宅急送', category: '餐饮美食', categorySource: 'auto' }),
    ]);
    expect(lookupMerchantMemory(memory, '肯德基宅急送')).toEqual({ category: '餐饮美食' });
  });

  it('推测出来的分类不进记忆', () => {
    const memory = buildMerchantMemory([
      txn({ counterparty: '某店', category: '餐饮美食', categorySource: 'guessed' }),
    ]);
    expect(lookupMerchantMemory(memory, '某店')).toBeNull();
  });

  it('同一商户两种分类 → 冲突，不投票', () => {
    const memory = buildMerchantMemory([
      txn({ id: 'a', counterparty: '某店', category: '餐饮美食', categorySource: 'manual' }),
      txn({ id: 'b', counterparty: '某店', category: '购物消费', categorySource: 'manual' }),
    ]);
    expect(lookupMerchantMemory(memory, '某店')).toEqual({ conflict: true });
  });

  it('商户键为 null 的记录不参与', () => {
    const memory = buildMerchantMemory([
      txn({ counterparty: '微信支付', description: '微信支付: 已支付¥22.30', category: '餐饮美食', categorySource: 'manual' }),
    ]);
    expect(memory.size).toBe(0);
  });
});

describe('extractMerchantKey 与记忆的配合', () => {
  it('带店名的记录能建立记忆键', () => {
    const t = txn({
      counterparty: '美团',
      description: '塔斯汀·中国汉堡(武汉宁康路店)-美团App-****218',
      categorySource: 'manual',
      category: '餐饮美食',
    });
    expect(extractMerchantKey(t)).toBe('塔斯汀');
    const memory = buildMerchantMemory([t]);
    expect(lookupMerchantMemory(memory, '塔斯汀')).toEqual({ category: '餐饮美食' });
  });
});
