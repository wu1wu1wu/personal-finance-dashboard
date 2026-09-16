import { describe, it, expect } from 'vitest'
import { parseCapturedTransaction } from './transaction-capture'

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
