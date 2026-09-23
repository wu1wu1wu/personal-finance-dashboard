import { describe, it, expect } from 'vitest'
import {
  parseCapturedTransaction,
  cleanCapturedText,
  type CaptureRule,
} from './transaction-capture'

describe('parseCapturedTransaction', () => {
  it('银行短信：消费支出', () => {
    const r = parseCapturedTransaction('【招商银行】您尾号1234卡8月30日20:05消费人民币100.00元')
    expect(r?.transactionType).toBe('支出')
    expect(r?.amount).toBe(100)
    expect(r?.counterparty).toBe('招商银行')
  })

  it('银行短信：收入到账', () => {
    const r = parseCapturedTransaction('【工商银行】您尾号8888卡收入人民币5000.00元')
    expect(r?.transactionType).toBe('收入')
    expect(r?.amount).toBe(-5000)
  })

  it('微信支付：付款', () => {
    const r = parseCapturedTransaction('微信支付提醒：已支付¥20.00')
    expect(r?.transactionType).toBe('支出')
    expect(r?.amount).toBe(20)
    expect(r?.counterparty).toBe('微信支付')
  })

  it('微信通知：标题与正文拼接（真机格式）', () => {
    const r = parseCapturedTransaction('微信支付 已支付¥96.00')
    expect(r?.transactionType).toBe('支出')
    expect(r?.amount).toBe(96)
    expect(r?.counterparty).toBe('微信支付')
  })

  it('微信通知：正文与金额间有空格', () => {
    const r = parseCapturedTransaction('微信支付 已支付 ¥96.00')
    expect(r?.amount).toBe(96)
  })

  it('收款到账', () => {
    const r = parseCapturedTransaction('收款到账¥100.00')
    expect(r?.transactionType).toBe('收入')
    expect(r?.amount).toBe(-100)
  })

  it('非交易短信（验证码）返回 null', () => {
    expect(parseCapturedTransaction('您的验证码是123456，请勿泄露')).toBeNull()
  })

  it('空文本返回 null', () => {
    expect(parseCapturedTransaction('')).toBeNull()
  })
})

// 这两条来自真机截图：都是「账单提醒」，钱根本没动，却被记成了支出
describe('反向语义：提醒类消息不能记账', () => {
  it('「您已产生1个待支付账单共1100元」不应记为支出', () => {
    const sms =
      '【贝壳省心租】王操群您好，您已产生1个待支付账单共1100元，应缴日期为2026年09月30日。请登录贝壳找房APP付款（勿线下支付），避免影响居住。如已支付请忽略，感谢配合，祝您生活愉快！'
    expect(parseCapturedTransaction(sms)).toBeNull()
  })

  it('链家的待支付提醒不应被解析成 ¥1', () => {
    const text =
      '通知中心 com.lianjia.beike scm67699790156667799hl 1000 亲爱的王操群，您已产生0个租金账单未及时支付，1个租金账单待支付，请尽快登录缴费。'
    expect(parseCapturedTransaction(text)).toBeNull()
  })

  it('「支付失败」「交易失败」都不记账', () => {
    expect(parseCapturedTransaction('微信支付：支付失败，金额¥50.00')).toBeNull()
    expect(parseCapturedTransaction('交易失败，已扣款¥30.00将原路退回')).toBeNull()
  })

  it('正常已支付的仍然能记账', () => {
    const r = parseCapturedTransaction('微信支付 已支付¥96.00')
    expect(r?.amount).toBe(96)
  })
})

describe('金额提取', () => {
  it('不会把「待支付，1个账单」里的 1 当成金额', () => {
    // 去掉反向语义词后，剩下这句仍然有「支付」+ 数字，容易误判
    const r = parseCapturedTransaction('本期账单支付¥88.00，共2个账单')
    expect(r?.amount).toBe(88)
  })

  it('金额后跟量词的数字不当金额', () => {
    expect(parseCapturedTransaction('消费3个订单，合计¥120.00')?.amount).toBe(120)
  })

  it('支持千分位', () => {
    expect(parseCapturedTransaction('【招商银行】消费人民币12,800.00元')?.amount).toBe(12800)
  })
})

describe('文本清理', () => {
  it('去掉通知里的系统类名', () => {
    const raw = '已支付¥20.00 androidx.core.app.NotificationCompat$BigTextStyle'
    expect(cleanCapturedText(raw)).toBe('已支付¥20.00')
  })

  it('去掉超长 token（订单号/签名）', () => {
    const raw = '已支付¥20.00 dLEgyU0hDCLc6K8n2aTNrXG1hMT4Y9OntnWXb8JyfEWdGSm123456'
    expect(cleanCapturedText(raw)).toBe('已支付¥20.00')
  })

  it('整段没有空格的中文短信不能被当成超长 token 删掉', () => {
    const raw = '您尾号1234卡9月23日12:05消费人民币88.50元，余额1000.00元'
    expect(cleanCapturedText(raw)).toBe(raw)
  })
})

describe('自定义规则', () => {
  const rule = (overrides: Partial<CaptureRule> = {}): CaptureRule => ({
    id: 'r1',
    name: '测试规则',
    enabled: true,
    packageMatch: '',
    contains: [],
    excludes: [],
    amountRegex: '',
    direction: 'expense',
    category: '',
    ...overrides,
  })

  it('命中规则时按规则指定方向和分类', () => {
    const text = '【某银行】您有一笔入账通知 ¥300.00'
    const r = parseCapturedTransaction(text, {
      rules: [rule({ contains: ['某银行'], direction: 'income', category: '其他' })],
    })
    expect(r?.amount).toBe(-300)
    expect(r?.transactionType).toBe('收入')
    expect(r?.category).toBe('其他')
    expect(r?.matchedRuleId).toBe('r1')
  })

  it('规则可以用自定义正则取金额', () => {
    const text = '到账通知 金额=1,234.50 元'
    const r = parseCapturedTransaction(text, {
      rules: [rule({ amountRegex: '金额=([\\d,.]+)', direction: 'income' })],
      // 没有方向关键词也能靠规则兜住
    })
    expect(r?.amount).toBe(-1234.5)
  })

  it('自定义规则可以绕过反向语义过滤', () => {
    const text = '【某银行】待支付账单提醒，本期应缴 500.00元'
    expect(parseCapturedTransaction(text)).toBeNull()
    const r = parseCapturedTransaction(text, {
      rules: [rule({ contains: ['待支付'], direction: 'expense' })],
    })
    expect(r?.amount).toBe(500)
  })

  it('excludes 命中时跳过该规则', () => {
    const text = '【某银行】已支付¥20.00'
    const r = parseCapturedTransaction(text, {
      rules: [rule({ contains: ['某银行'], excludes: ['已支付'] })],
    })
    // 规则被跳过，落回内置逻辑
    expect(r?.matchedRuleId).toBeUndefined()
    expect(r?.amount).toBe(20)
  })

  it('packageMatch 限定来源', () => {
    const r = parseCapturedTransaction('已支付¥20.00', {
      packageName: 'com.tencent.mm',
      rules: [rule({ packageMatch: 'com.icbc', category: '其他' })],
    })
    expect(r?.matchedRuleId).toBeUndefined()
  })
})

describe('全局忽略', () => {
  it('忽略指定包名', () => {
    const r = parseCapturedTransaction('已支付¥20.00', {
      packageName: 'com.tencent.qqmusic',
      settings: { ignorePackages: ['com.tencent.qqmusic'], ignoreKeywords: [] },
    })
    expect(r).toBeNull()
  })

  it('忽略指定关键词', () => {
    const r = parseCapturedTransaction('已支付¥20.00 会员续费', {
      settings: { ignorePackages: [], ignoreKeywords: ['会员续费'] },
    })
    expect(r).toBeNull()
  })
})
