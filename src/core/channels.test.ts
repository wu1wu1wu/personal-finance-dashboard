// src/core/channels.test.ts
import { describe, it, expect } from 'vitest';
import { detectChannel, isChannelWord, ECOMMERCE_CHANNELS, PLATFORM_CHANNELS } from './channels';

describe('detectChannel', () => {
  it('电商平台识别为 ecommerce', () => {
    expect(detectChannel('淘宝平台商户 商户单号XP****4169')).toEqual({ name: '淘宝', kind: 'ecommerce' });
    expect(detectChannel('拼多多')?.kind).toBe('ecommerce');
  });

  it('综合平台识别为 platform', () => {
    expect(detectChannel('美团 塔斯汀·中国汉堡(武汉宁康路店)-美团App-***')).toEqual({
      name: '美团',
      kind: 'platform',
    });
    expect(detectChannel('抖音生活服务商家')?.kind).toBe('platform');
  });

  it('没有渠道返回 null', () => {
    expect(detectChannel('星巴克咖啡')).toBeNull();
    expect(detectChannel('')).toBeNull();
  });

  it('长词优先（美团单车里识别出美团）', () => {
    expect(detectChannel('美团单车')?.name).toBe('美团');
  });
});

describe('isChannelWord', () => {
  it('渠道词不参与品类关键词匹配', () => {
    expect(isChannelWord('美团')).toBe(true);
    expect(isChannelWord('淘宝')).toBe(true);
    expect(isChannelWord('星巴克')).toBe(false);
  });

  it('两张表的并集', () => {
    for (const c of [...ECOMMERCE_CHANNELS, ...PLATFORM_CHANNELS]) expect(isChannelWord(c)).toBe(true);
  });
});
