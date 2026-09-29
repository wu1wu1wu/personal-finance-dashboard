import { describe, it, expect } from 'vitest'
import {
  maskBankCard,
  maskName,
  maskPhone,
  maskCounterparty,
  maskTransaction,
} from './data-masker'
import type { Transaction } from '@/types'

describe('maskBankCard', () => {
  it('银行卡号仅保留后四位', () => {
    expect(maskBankCard('6222021234567890')).toBe('************7890')
  })
})

describe('maskName', () => {
  it('三字姓名保留姓', () => {
    expect(maskName('张三丰')).toBe('张**')
  })

  it('两字姓名保留姓', () => {
    expect(maskName('李四')).toBe('李*')
  })

  it('复姓保留首字', () => {
    expect(maskName('欧阳修')).toBe('欧**')
  })

  it('单字或空原样返回', () => {
    expect(maskName('王')).toBe('王')
    expect(maskName('')).toBe('')
  })
})

describe('maskPhone', () => {
  it('手机号中间四位打码', () => {
    expect(maskPhone('13812345678')).toBe('138****5678')
  })
})

describe('maskCounterparty', () => {
  it('对交易对方中的手机号脱敏', () => {
    expect(maskCounterparty('13812345678')).toBe('138****5678')
  })
})

describe('maskTransaction', () => {
  it('脱敏单条交易（对方 + 交易单号）', () => {
    const txn: Transaction = {
      id: '1',
      transactionTime: '2026-07-05 14:30:00',
      transactionType: '支出',
      counterparty: '6222021234567890',
      description: '',
      amount: 100,
      paymentStatus: '',
      transactionNo: '1234567890123456',
      paymentMethod: '',
      category: '',
      categorySource: 'auto',
      isPeriodic: false,
      tags: [],
      createdAt: '',
      coverImage: '',
      theme: '',
      origin: 'import',
    }
    const masked = maskTransaction(txn)
    expect(masked.counterparty).toBe('************7890')
    expect(masked.transactionNo).toBe('1234****3456')
  })

  // 自动捕获的 description 是短信/通知原文，里面可能有卡号、手机号，
  // 导出备份时同样必须脱敏，否则"脱敏"只做了半截
  it('商品说明（短信原文）也要脱敏', () => {
    const txn: Transaction = {
      id: '1',
      transactionTime: '2026-07-05 14:30:00',
      transactionType: '支出',
      counterparty: '招商银行',
      description: '您尾号6222021234567890卡消费100元，联系电话13812345678',
      amount: 100,
      paymentStatus: '',
      transactionNo: '',
      paymentMethod: '',
      category: '',
      categorySource: 'auto',
      isPeriodic: false,
      tags: [],
      createdAt: '',
      coverImage: '',
      theme: '',
      origin: 'auto',
    }

    const masked = maskTransaction(txn)

    expect(masked.description).toBe('您尾号************7890卡消费100元，联系电话138****5678')
  })
})
