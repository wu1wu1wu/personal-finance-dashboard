// src/core/merchant-key.ts
// ============================================================
// 商户键抽取
//
// 微信账单的「商品说明」里通常写着真店名（塔斯汀·中国汉堡(武汉宁康路店)-美团App-***），
// 而「交易对方」只是渠道名（美团）。分类应该认店名，不是认渠道。
// 支付通知（微信支付: 已支付¥22.30）里没有任何商户信息，此时必须返回 null，
// 绝不能把通知原文当成商户名——那会让"商户记忆"学进一堆垃圾键。
// ============================================================

import type { Transaction } from '@/types';

/** 商户键最长长度：超过它基本是整段通知原文，不是店名 */
export const MAX_MERCHANT_KEY_LENGTH = 24;

/** 商户键最短长度 */
const MIN_MERCHANT_KEY_LENGTH = 2;

/** 出现这些字样说明是通知/短信原文，不是商户 */
const NOTIFY_PATTERN =
  /已支付|入账工资|已到账|您账户|已隐藏敏感通知内容|理赔|转账备注|收款方备注/;

/** 平台名：单独出现时不能当商户（美团、淘宝… 是渠道，不是店） */
const CHANNEL_PATTERN =
  /^(微信支付|微信转账|支付宝|美团|饿了么|淘宝|京东|拼多多|天猫|抖音|高德|唯品会|苏宁)$/;

/**
 * 这些「交易对方」也不是商户：
 * - 「招商银行」是短信发送方，不是店；
 * - 「淘宝平台商户」是平台合成的占位名，真店名在「商品说明」里。
 */
const NON_MERCHANT_PATTERN = /银行$|信用社$|平台商户$/;

/** 依次剥离的噪声 */
function stripNoise(input: string): string {
  return input
    .replace(/^(微信支付|支付宝)[:：]\s*/, '')
    .replace(/\[?\d+条\]?/g, ' ')
    .replace(/商户单号[^\s]*|订单号[^\s]*|订单[-\s]*编号[^\s]*/g, ' ')
    .replace(/美团App|饿了么App|美团平台商户|淘宝平台商户|美团收银|美团订单/g, ' ')
    .replace(/为[\d\s]{6,}充值[^\s]*/g, ' ')
    .replace(/[¥￥]\s*[\d.]+/g, ' ')
    .replace(/\*{2,}/g, ' ')
    // 脱敏后的单号只剩后 4 位，会以独立数字的形式残留
    .replace(/(?<![0-9])\d{4}(?![0-9])/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * 归一化商户键：去分店括号、按 `·` 截断连锁后缀。
 * 返回 null 表示这个键不可用。
 */
export function normalizeMerchantKey(raw: string): string | null {
  const key = raw
    .replace(/（[^）]*店）|\([^)]*店\)/g, ' ')
    .replace(/[·•・].*$/, '')
    .replace(/[-－\s]+$/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  if (key.length < MIN_MERCHANT_KEY_LENGTH || key.length > MAX_MERCHANT_KEY_LENGTH) return null;
  if (CHANNEL_PATTERN.test(key) || NON_MERCHANT_PATTERN.test(key)) return null;
  return key;
}

/**
 * 抽取商户键。抽不出返回 null。
 * 优先用「商品说明」（带真店名），说明没货时退回「交易对方」。
 */
export function extractMerchantKey(
  txn: Pick<Transaction, 'counterparty' | 'description'>,
): string | null {
  const description = stripNoise(txn.description ?? '');
  const usable = description !== '' && !NOTIFY_PATTERN.test(description);

  if (usable) {
    const fromDescription = normalizeMerchantKey(description);
    if (fromDescription) return fromDescription;
  }

  const counterparty = (txn.counterparty ?? '').trim();
  if (!counterparty || NOTIFY_PATTERN.test(counterparty)) return null;
  return normalizeMerchantKey(counterparty);
}
