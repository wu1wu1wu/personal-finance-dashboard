import { describe, it, expect } from 'vitest';
import { classifyByKeyword } from './keyword-match';
import { BUILTIN_RULES } from '@/constants/rules'
import { ECOMMERCE_CHANNELS, PLATFORM_CHANNELS } from './channels'

describe('classifyByKeyword', () => {
  it('最长词优先：超市压过渠道词美团', () => {
    const hit = classifyByKeyword(
      { transactionType: '支出', counterparty: '美团', description: '云上优家超市（沌口店）-美团App-***' },
      { customRules: [] },
    );
    expect(hit?.category).toBe('购物消费');
    expect(hit?.keyword).toBe('超市');
  });

  it('渠道词本身不参与匹配', () => {
    const hit = classifyByKeyword(
      { transactionType: '支出', counterparty: '美团', description: '塔斯汀·中国汉堡' },
      { customRules: [] },
    );
    expect(hit?.keyword).not.toBe('美团');
    expect(hit?.keyword).toBe('塔斯汀');
  });

  it('自定义规则优先', () => {
    const hit = classifyByKeyword(
      { transactionType: '支出', counterparty: '星巴克', description: '' },
      { customRules: [{ id: 'c', keywords: ['星巴克'], category: '休闲娱乐', priority: 100, isCustom: true, hitCount: 0 }] },
    );
    expect(hit?.category).toBe('休闲娱乐');
  });

  it('都没有命中返回 null', () => {
    expect(
      classifyByKeyword({ transactionType: '支出', counterparty: '某未知商户', description: '' }, { customRules: [] }),
    ).toBeNull();
  });

  it('反例词让该关键词作废（自助洗车不算普通洗车）', () => {
    const hit = classifyByKeyword(
      { transactionType: '支出', counterparty: '某店', description: '自助洗车' },
      {
        customRules: [
          { id: 'c', keywords: ['洗车'], category: '交通出行', priority: 100, isCustom: true, hitCount: 0, excludes: ['自助'] },
        ],
      },
    );
    expect(hit).toBeNull();
  });
});

describe('规则表', () => {
  it('内置词表里不再有渠道词', () => {
    const words = BUILTIN_RULES.flatMap((r) => r.keywords)
    for (const channel of [...ECOMMERCE_CHANNELS, ...PLATFORM_CHANNELS]) {
      expect(words).not.toContain(channel)
    }
  })
})
