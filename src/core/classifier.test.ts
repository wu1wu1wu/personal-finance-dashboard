import { describe, it, expect } from 'vitest'
import {
  classifyTransaction,
  classifyTransactions,
  processFeedback,
  isValidCategory,
} from './classifier'
import type { Transaction, ClassificationRule } from '@/types'

function makeTxn(overrides: Partial<Transaction> = {}): Transaction {
  return {
    id: 'txn-1',
    transactionTime: '2026-07-05 14:30:00',
    transactionType: '支出',
    counterparty: '',
    description: '',
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
    ...overrides,
  }
}

describe('classifyTransaction', () => {
  it('内置规则：美团 → 餐饮美食', () => {
    expect(classifyTransaction(makeTxn({ counterparty: '美团外卖' }))).toBe('餐饮美食')
  })

  it('内置规则：滴滴 → 交通出行', () => {
    expect(classifyTransaction(makeTxn({ counterparty: '滴滴出行' }))).toBe('交通出行')
  })

  it('未命中任何规则 → 待确认', () => {
    expect(classifyTransaction(makeTxn({ counterparty: '未知商户XYZ' }))).toBe('待确认')
  })

  it('自定义规则优先于内置规则', () => {
    const custom: ClassificationRule = {
      id: 'r1',
      keywords: ['美团'],
      category: '其他',
      priority: 100,
      isCustom: true,
      hitCount: 0,
    }
    expect(classifyTransaction(makeTxn({ counterparty: '美团外卖' }), [custom])).toBe('其他')
  })

  it('具体分类优先于「其他」兜底规则', () => {
    // 同时命中「美团」（餐饮，priority 10）与「转账」（其他，priority 5）
    expect(classifyTransaction(makeTxn({ counterparty: '美团', description: '转账' }))).toBe('餐饮美食')
  })

  it('仅命中兜底关键词时归为「其他」', () => {
    expect(classifyTransaction(makeTxn({ description: '转账' }))).toBe('其他')
  })

  it('多个自定义规则命中时按 priority 降序取最高', () => {
    const rules: ClassificationRule[] = [
      { id: 'low', keywords: ['美团'], category: '医疗健康', priority: 100, isCustom: true, hitCount: 0 },
      { id: 'high', keywords: ['美团'], category: '购物消费', priority: 200, isCustom: true, hitCount: 0 },
    ]
    expect(classifyTransaction(makeTxn({ counterparty: '美团' }), rules)).toBe('购物消费')
  })
})

describe('classifyTransactions', () => {
  it('已手动分类的不被覆盖', () => {
    const txns = [
      makeTxn({ counterparty: '美团', category: '医疗健康', categorySource: 'manual' }),
      makeTxn({ counterparty: '滴滴', category: '' }),
    ]
    const { classified, stats } = classifyTransactions(txns)
    expect(classified[0].category).toBe('医疗健康')
    expect(classified[1].category).toBe('交通出行')
    expect(stats['医疗健康']).toBe(1)
  })
})

describe('processFeedback', () => {
  it('反馈少于 3 次不升级为规则', () => {
    const rules = processFeedback({ 美团: { category: '其他', count: 2 } }, [])
    expect(rules).toHaveLength(0)
  })

  it('反馈达到 3 次升级为自定义规则', () => {
    const rules = processFeedback({ 美团: { category: '其他', count: 3 } }, [])
    expect(rules).toHaveLength(1)
    expect(rules[0].category).toBe('其他')
    expect(rules[0].isCustom).toBe(true)
    expect(rules[0].priority).toBe(100)
  })

  it('已存在的关键词不重复升级', () => {
    const existing: ClassificationRule = {
      id: 'r1',
      keywords: ['美团'],
      category: '其他',
      priority: 100,
      isCustom: true,
      hitCount: 0,
    }
    const rules = processFeedback({ 美团: { category: '其他', count: 3 } }, [existing])
    expect(rules).toHaveLength(0)
  })
})

describe('isValidCategory', () => {
  it('判断分类是否有效', () => {
    expect(isValidCategory('餐饮美食')).toBe(true)
    expect(isValidCategory('不存在的分类')).toBe(false)
  })
})
