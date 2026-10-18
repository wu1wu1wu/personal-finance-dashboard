// src/core/merchant-key.test.ts
import { describe, it, expect } from 'vitest';
import { extractMerchantKey, normalizeMerchantKey } from './merchant-key';

const txn = (counterparty: string, description = '') => ({ counterparty, description });

describe('extractMerchantKey', () => {
  it('从美团账单里抽出真店名', () => {
    expect(extractMerchantKey(txn('美团', '塔斯汀·中国汉堡(武汉宁康路店)-美团App-****218'))).toBe('塔斯汀');
  });

  it('剥掉渠道与单号后保留店名主体', () => {
    expect(extractMerchantKey(txn('美团', '云上优家超市（沌口店）-美团App-****4169'))).toBe('云上优家超市');
  });

  it('支付通知没有商户 → null', () => {
    expect(extractMerchantKey(txn('微信支付', '微信支付: 已支付¥22.30'))).toBeNull();
    expect(extractMerchantKey(txn('微信支付', '微信支付: 已支付¥28.90 [2条]微信支付: 已支付¥28.90'))).toBeNull();
  });

  it('银行短信没有商户 → null', () => {
    expect(
      extractMerchantKey(txn('招商银行', '招商银行: 【招商银行】您账户7301于10月12日入账工资，人民币1800.00。')),
    ).toBeNull();
  });

  it('转账备注不是商户 → null', () => {
    expect(extractMerchantKey(txn('微信转账', '转账备注:微信转账'))).toBeNull();
  });

  it('平台本身不算商户', () => {
    expect(extractMerchantKey(txn('淘宝平台商户', '商户单号XP****4169'))).toBeNull();
    expect(extractMerchantKey(txn('美团', ''))).toBeNull();
  });

  it('描述为空时退回交易对方', () => {
    expect(extractMerchantKey(txn('霸王茶姬'))).toBe('霸王茶姬');
    expect(extractMerchantKey(txn('湖工大-沌阳大道'))).toBe('湖工大-沌阳大道');
  });

  it('脱敏残留的四位数字要清掉', () => {
    expect(extractMerchantKey(txn('美团', '七婆婆酱排骨蹄花焖锅- - 4180'))).toBe('七婆婆酱排骨蹄花焖锅');
  });
});

describe('normalizeMerchantKey', () => {
  it('分店括号去掉，连锁后缀按 · 截断', () => {
    expect(normalizeMerchantKey('塔斯汀·中国汉堡(武汉宁康路店)')).toBe('塔斯汀');
    expect(normalizeMerchantKey('尚酥坊·手工點心（沌口店）')).toBe('尚酥坊');
  });

  it('太短的键丢弃', () => {
    expect(normalizeMerchantKey('店')).toBeNull();
    expect(normalizeMerchantKey('')).toBeNull();
  });
});
