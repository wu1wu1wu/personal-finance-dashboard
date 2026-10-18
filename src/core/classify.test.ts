// src/core/classify.test.ts
import { describe, it, expect } from 'vitest';
import type { Transaction } from '@/types';
import { classifyTransactionDetailed } from './classify';
import { buildMerchantMemory } from './merchant-memory';

function txn(partial: Partial<Transaction> = {}): Transaction {
  return {
    id: partial.id ?? 'x',
    transactionTime: '2026-09-01 12:00:00',
    transactionType: '支出',
    counterparty: '',
    description: '',
    amount: 22,
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

const amountTimeRules = [
  { category: '餐饮美食', startMinute: 600, endMinute: 1260, minAmount: 15, maxAmount: 25, support: 12, hitRate: 0.83 },
];

describe('L1 你设的', () => {
  it('手设分类原样返回，等级 certain', () => {
    const r = classifyTransactionDetailed(
      txn({ counterparty: '美团', category: '交通出行', categorySource: 'manual' }),
      { amountTimeRules },
    );
    expect(r).toMatchObject({ category: '交通出行', basis: 'user', level: 'certain' });
  });
});

describe('L2 资金搬运与收入', () => {
  it('转账类词 → 转账', () => {
    const r = classifyTransactionDetailed(txn({ description: '转账备注:微信转账', amount: 200 }), { amountTimeRules });
    expect(r).toMatchObject({ category: '转账', basis: 'transfer', level: 'certain' });
  });

  it('金额为负且非转账 → 收入', () => {
    const r = classifyTransactionDetailed(txn({ amount: -1800, counterparty: '招商银行', description: '入账工资' }), {
      amountTimeRules,
    });
    expect(r).toMatchObject({ category: '收入', basis: 'income', level: 'certain' });
  });

  it('退款优先于收入', () => {
    const r = classifyTransactionDetailed(txn({ amount: -50, description: '退款' }), { amountTimeRules });
    expect(r.category).toBe('转账');
  });
});

describe('L3 商户记忆', () => {
  const memory = buildMerchantMemory([
    txn({ id: 'a', counterparty: '塔斯汀', category: '餐饮美食', categorySource: 'manual' }),
  ]);

  it('记忆命中 → certain', () => {
    const r = classifyTransactionDetailed(txn({ counterparty: '塔斯汀' }), { memory, amountTimeRules });
    expect(r).toMatchObject({ category: '餐饮美食', basis: 'memory', level: 'certain' });
  });

  it('记忆冲突 → 待确认', () => {
    const conflictMemory = buildMerchantMemory([
      txn({ id: 'a', counterparty: '某店', category: '餐饮美食', categorySource: 'manual' }),
      txn({ id: 'b', counterparty: '某店', category: '购物消费', categorySource: 'manual' }),
    ]);
    const r = classifyTransactionDetailed(txn({ counterparty: '某店' }), { memory: conflictMemory, amountTimeRules });
    expect(r.category).toBe('待确认');
    expect(r.level).toBe('pending');
  });
});

describe('L4 关键词', () => {
  it('命中品类词 → certain', () => {
    const r = classifyTransactionDetailed(txn({ counterparty: '星巴克咖啡' }), { amountTimeRules });
    expect(r).toMatchObject({ category: '餐饮美食', basis: 'keyword', level: 'certain' });
  });

  it('渠道词不再抢词：云上优家超市归购物', () => {
    const r = classifyTransactionDetailed(
      txn({ counterparty: '美团', description: '云上优家超市（沌口店）-美团App-***' }),
      { amountTimeRules },
    );
    expect(r.category).toBe('购物消费');
    expect(r.basis).toBe('keyword');
  });
});

describe('L5 渠道', () => {
  it('电商型渠道 → 购物，certain', () => {
    const r = classifyTransactionDetailed(txn({ counterparty: '淘宝平台商户', description: '商户单号XP***' }), {
      amountTimeRules,
    });
    expect(r).toMatchObject({ category: '购物消费', basis: 'ecommerce', level: 'certain' });
  });

  it('综合型渠道历史不足 → 不猜', () => {
    const r = classifyTransactionDetailed(txn({ counterparty: '抖音', description: '新客福利精剪+洗吹+造型', amount: 63 }), {
      amountTimeRules,
      channelStats: new Map(),
    });
    expect(r.category).toBe('待确认');
  });

  it('综合型渠道历史达标 → 推测', () => {
    const channelStats = new Map([['美团', new Map([['餐饮美食', 8]])]]);
    const r = classifyTransactionDetailed(
      txn({ counterparty: '美团', description: '', amount: 40, transactionTime: '2026-09-01 12:00:00' }),
      { amountTimeRules: [], channelStats },
    );
    expect(r).toMatchObject({ category: '餐饮美食', basis: 'channel-guess', level: 'guessed' });
  });
});

describe('L6 时段金额（只对无商户记录）', () => {
  it('无商户 + 落在区间 → 推测', () => {
    const r = classifyTransactionDetailed(
      txn({ counterparty: '微信支付', description: '微信支付: 已支付¥22.30', amount: 22.3, transactionTime: '2026-10-01 12:00:00' }),
      { amountTimeRules },
    );
    expect(r).toMatchObject({ category: '餐饮美食', basis: 'amount-time', level: 'guessed' });
  });

  it('有商户时不套用金额规则', () => {
    const r = classifyTransactionDetailed(
      txn({ counterparty: '美团单车', description: '', amount: 15.8, transactionTime: '2026-09-01 16:23:00' }),
      { amountTimeRules },
    );
    expect(r.category).not.toBe('餐饮美食');
  });

  it('超出区间 → 待确认', () => {
    const r = classifyTransactionDetailed(
      txn({ counterparty: '微信支付', description: '微信支付: 已支付¥46.93', amount: 46.93 }),
      { amountTimeRules },
    );
    expect(r).toMatchObject({ category: '待确认', basis: 'none', level: 'pending' });
  });
});
