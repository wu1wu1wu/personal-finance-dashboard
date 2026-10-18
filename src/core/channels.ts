// src/core/channels.ts
// ============================================================
// 渠道词表
//
// 电商型：在这些平台下单本身就是"购物"，是平台性质，不是猜。
// 综合型：同一平台什么都能买（美团：外卖/单车/买药/超市），只能作为"推测"依据，
//         且必须结合该渠道的历史分类与店名。
//
// 渠道词**不参与品类关键词匹配**——这是"美团单车被判餐饮"的根因。
// ============================================================

export const ECOMMERCE_CHANNELS = ['淘宝', '拼多多', '天猫', '京东', '唯品会'] as const;
export const PLATFORM_CHANNELS = ['美团', '饿了么', '抖音', '高德'] as const;

export type ChannelKind = 'ecommerce' | 'platform';

export interface DetectedChannel {
  name: string;
  kind: ChannelKind;
}

/** 所有渠道词，按长度降序，保证长词优先匹配 */
const ALL_CHANNELS: { name: string; kind: ChannelKind }[] = [
  ...ECOMMERCE_CHANNELS.map((name) => ({ name, kind: 'ecommerce' as const })),
  ...PLATFORM_CHANNELS.map((name) => ({ name, kind: 'platform' as const })),
].sort((a, b) => b.name.length - a.name.length);

export function isChannelWord(word: string): boolean {
  return ALL_CHANNELS.some((c) => c.name === word);
}

/** 从一段文本里识别渠道，识别不到返回 null */
export function detectChannel(text: string): DetectedChannel | null {
  if (!text) return null;
  const hit = ALL_CHANNELS.find((c) => text.includes(c.name));
  return hit ?? null;
}
