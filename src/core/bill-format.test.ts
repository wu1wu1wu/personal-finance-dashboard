import { describe, expect, it } from 'vitest';
import {
  cleanField,
  detectBillFormat,
  hasRequiredColumns,
  isInformativeType,
  isUnpaidAlipayStatus,
  mergeDescription,
  normalizeHeaderCell,
  resolveDirection,
} from './bill-format';

const WECHAT_HEADER = [
  '交易时间',
  '交易类型',
  '交易对方',
  '商品',
  '收/支',
  '金额(元)',
  '支付方式',
  '当前状态',
  '交易单号',
  '商户单号',
  '备注',
];

const ALIPAY_HEADER = [
  '交易号',
  '商家订单号',
  '交易创建时间',
  '付款时间',
  '最近修改时间',
  '交易来源地',
  '类型',
  '交易对方',
  '商品名称',
  '金额（元）',
  '收/支',
  '交易状态',
  '服务费（元）',
  '成功退款（元）',
  '备注',
  '资金状态',
];

describe('detectBillFormat', () => {
  it('微信表头识别为 wechat', () => {
    expect(detectBillFormat(WECHAT_HEADER)).toBe('wechat');
  });

  it('支付宝表头识别为 alipay', () => {
    expect(detectBillFormat(ALIPAY_HEADER)).toBe('alipay');
  });

  it('支付宝表头带空格与 BOM 也能认出来', () => {
    const padded = ALIPAY_HEADER.map((h, i) => (i === 0 ? `\uFEFF${h}   ` : `  ${h}  `));
    expect(detectBillFormat(padded)).toBe('alipay');
  });

  it('老版支付宝表头（支付宝交易号）同样认识', () => {
    expect(detectBillFormat(['支付宝交易号', '交易创建时间', '金额（元）', '收/支'])).toBe(
      'alipay',
    );
  });

  it('认不出来就是 unknown，不能瞎猜', () => {
    expect(detectBillFormat([])).toBe('unknown');
    expect(detectBillFormat(['日期', '金额', '备注'])).toBe('unknown');
    expect(detectBillFormat([''])).toBe('unknown');
  });

  it('微信的「交易单号」不会被当成支付宝的「交易号」', () => {
    expect(detectBillFormat(['交易单号', '商户单号'])).toBe('wechat');
    expect(detectBillFormat(['交易创建时间', '资金状态'])).toBe('alipay');
  });
});

describe('hasRequiredColumns', () => {
  it('微信：缺交易单号时必须判定为不合格', () => {
    expect(hasRequiredColumns(WECHAT_HEADER, 'wechat')).toBe(true);
    expect(hasRequiredColumns(WECHAT_HEADER.filter((h) => h !== '交易单号'), 'wechat')).toBe(
      false,
    );
  });

  it('支付宝：缺交易号或时间列时不合格', () => {
    expect(hasRequiredColumns(ALIPAY_HEADER, 'alipay')).toBe(true);
    expect(hasRequiredColumns(ALIPAY_HEADER.filter((h) => h !== '交易号'), 'alipay')).toBe(false);
    expect(
      hasRequiredColumns(ALIPAY_HEADER.filter((h) => h !== '交易创建时间' && h !== '付款时间'), 'alipay'),
    ).toBe(false);
  });

  it('只有付款时间也算合格（部分导出没有创建时间）', () => {
    expect(
      hasRequiredColumns(['交易号', '付款时间', '金额（元）', '收/支'], 'alipay'),
    ).toBe(true);
  });
});

describe('normalizeHeaderCell', () => {
  it('去掉 BOM 与所有空白', () => {
    expect(normalizeHeaderCell('\uFEFF交易号   ')).toBe('交易号');
    expect(normalizeHeaderCell(' 金额（元） ')).toBe('金额（元）');
  });
});

describe('isUnpaidAlipayStatus', () => {
  it('钱没动的状态要能被识别', () => {
    expect(isUnpaidAlipayStatus('交易关闭')).toBe(true);
    expect(isUnpaidAlipayStatus('等待付款')).toBe(true);
    expect(isUnpaidAlipayStatus(' 已关闭 ')).toBe(true);
  });

  it('付过钱的状态不能被误杀', () => {
    expect(isUnpaidAlipayStatus('交易成功')).toBe(false);
    expect(isUnpaidAlipayStatus('等待确认收货')).toBe(false);
    expect(isUnpaidAlipayStatus('')).toBe(false);
  });
});

describe('resolveDirection', () => {
  it('微信的支出/收入/「/」', () => {
    expect(resolveDirection({ incomeExpense: '支出' })).toBe('expense');
    expect(resolveDirection({ incomeExpense: '收入' })).toBe('income');
    expect(resolveDirection({ incomeExpense: '/' })).toBe('other');
  });

  it('支付宝的「不计收支」不算支出', () => {
    expect(resolveDirection({ incomeExpense: '不计收支' })).toBe('other');
  });

  it('没有收/支列时用资金状态兜底', () => {
    expect(resolveDirection({ fundStatus: '已支出' })).toBe('expense');
    expect(resolveDirection({ fundStatus: '已收入' })).toBe('income');
    expect(resolveDirection({ fundStatus: '冻结中' })).toBe('other');
  });

  it('收/支写了「不计收支」时不被资金状态推翻', () => {
    expect(resolveDirection({ incomeExpense: '不计收支', fundStatus: '已支出' })).toBe('other');
  });

  it('空字段一律 other，不能凭猜', () => {
    expect(resolveDirection({})).toBe('other');
    expect(resolveDirection({ incomeExpense: '' })).toBe('other');
  });

  it('「已支出」这种资金状态写法也认', () => {
    expect(resolveDirection({ incomeExpense: '已支出' })).toBe('expense');
  });
});

describe('mergeDescription', () => {
  it('资金搬运类类型并入描述（分类器靠它归到转账）', () => {
    expect(mergeDescription('转账', '给朋友')).toBe('转账: 给朋友');
    expect(mergeDescription('余额宝-单笔转入', '')).toBe('余额宝-单笔转入');
  });

  it('普通消费类型不并入，描述保持干净', () => {
    expect(mergeDescription('即时到账交易', '咖啡')).toBe('咖啡');
    expect(mergeDescription('商户消费', '快件畅存费')).toBe('快件畅存费');
  });

  it('描述里已经含类型时不重复拼接', () => {
    expect(mergeDescription('转账', '转账给朋友')).toBe('转账给朋友');
  });

  it('占位符当空值', () => {
    expect(mergeDescription('/', '/')).toBe('');
    expect(mergeDescription('转账', '无')).toBe('转账');
  });
});

describe('isInformativeType / cleanField', () => {
  it('包含匹配，复合词也算命中', () => {
    expect(isInformativeType('零钱提现')).toBe(true);
    expect(isInformativeType('信用卡还款')).toBe(true);
    expect(isInformativeType('余额宝-单笔转入')).toBe(true);
    expect(isInformativeType('商户消费')).toBe(false);
  });

  it('各种占位符都当空', () => {
    for (const value of ['/', '\\', '-', '--', '—', '无', 'N/A', 'null']) {
      expect(cleanField(value)).toBe('');
    }
    expect(cleanField(' 丰巢 ')).toBe('丰巢');
    expect(cleanField(undefined)).toBe('');
  });
});
