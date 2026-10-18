// src/core/amount-time-rules.test.ts
import { describe, it, expect } from 'vitest';
import type { Transaction } from '@/types';
import {
  induceAmountTimeRules,
  matchAmountTimeRule,
  RULE_MIN_PURITY,
} from './amount-time-rules';

function txn(amount: number, time: string, category: string): Transaction {
  return {
    id: `${amount}-${time}-${category}`,
    transactionTime: time,
    transactionType: '支出',
    counterparty: '',
    description: '',
    amount,
    paymentStatus: '',
    transactionNo: '',
    paymentMethod: '',
    category,
    categorySource: 'manual',
    origin: 'manual',
    isPeriodic: false,
    tags: [],
    createdAt: time,
    coverImage: '',
    theme: '',
  };
}

describe('induceAmountTimeRules', () => {
  it('20 元档、午晚时段的餐饮占压倒多数时归纳成规则', () => {
    // 六条全部落在 20~25 元这个档里，纯度 100%，满足 支持≥5
    const confirmed = [
      txn(22.9, '2026-09-01 11:30:00', '餐饮美食'),
      txn(23.88, '2026-09-02 11:40:00', '餐饮美食'),
      txn(24.3, '2026-09-03 12:19:00', '餐饮美食'),
      txn(21.28, '2026-09-04 16:47:00', '餐饮美食'),
      txn(22.5, '2026-09-05 15:22:00', '餐饮美食'),
      txn(23.1, '2026-09-06 20:36:00', '餐饮美食'),
    ];
    const rules = induceAmountTimeRules(confirmed);
    expect(rules.length).toBeGreaterThan(0);
    const dining = rules.find((r) => r.category === '餐饮美食');
    expect(dining).toBeDefined();
    expect(dining!.minAmount).toBe(20);
    expect(dining!.maxAmount).toBe(25);
    expect(dining!.hitRate).toBeGreaterThanOrEqual(RULE_MIN_PURITY);
  });

  it('样本不足不产出规则', () => {
    const few = [
      txn(22, '2026-09-01 12:00:00', '餐饮美食'),
      txn(23, '2026-09-02 12:00:00', '餐饮美食'),
    ];
    expect(induceAmountTimeRules(few)).toEqual([]);
  });

  it('纯度不够不产出规则（金额档里混了别的分类）', () => {
    const mixed = [
      txn(22, '2026-09-01 12:00:00', '餐饮美食'),
      txn(23, '2026-09-02 12:00:00', '餐饮美食'),
      txn(24, '2026-09-03 12:00:00', '餐饮美食'),
      txn(21, '2026-09-04 12:00:00', '购物消费'),
      txn(20, '2026-09-05 12:00:00', '交通出行'),
      txn(25, '2026-09-06 12:00:00', '休闲娱乐'),
    ];
    expect(induceAmountTimeRules(mixed)).toEqual([]);
  });

  it('收入（负数）不参与规则归纳', () => {
    const withIncome = [
      txn(-1800, '2026-09-01 12:00:00', '收入'),
      ...Array.from({ length: 5 }, (_, i) => txn(20 + i, `2026-09-0${i + 1} 12:00:00`, '餐饮美食')),
    ];
    const rules = induceAmountTimeRules(withIncome);
    expect(rules.every((r) => r.category !== '收入')).toBe(true);
  });
});

describe('matchAmountTimeRule', () => {
  const rules = [
    { category: '餐饮美食', startMinute: 600, endMinute: 1260, minAmount: 15, maxAmount: 25, support: 12, hitRate: 0.83 },
  ];

  it('落在区间内命中', () => {
    expect(matchAmountTimeRule({ amount: 22.3, transactionTime: '2026-10-01 12:00:00' }, rules)?.category).toBe(
      '餐饮美食',
    );
  });

  it('金额超出区间不命中', () => {
    expect(matchAmountTimeRule({ amount: 46.93, transactionTime: '2026-10-01 12:00:00' }, rules)).toBeNull();
  });

  it('时段外不命中', () => {
    expect(matchAmountTimeRule({ amount: 22, transactionTime: '2026-10-01 05:00:00' }, rules)).toBeNull();
  });

  it('收入不套用支出规则', () => {
    expect(matchAmountTimeRule({ amount: -22, transactionTime: '2026-10-01 12:00:00' }, rules)).toBeNull();
  });
});
