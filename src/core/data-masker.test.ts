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
    }
    const masked = maskTransaction(txn)
    expect(masked.counterparty).toBe('************7890')
    expect(masked.transactionNo).toBe('1234****3456')
  })
})
