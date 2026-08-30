import { describe, it, expect } from 'vitest'
import { generateId, generateTransactionId } from './id'

describe('generateTransactionId', () => {
  it('相同输入产生相同 ID（确定性，用于去重）', () => {
    const a = generateTransactionId('2026-07-05 14:30:00', 100, 'TXN123')
    const b = generateTransactionId('2026-07-05 14:30:00', 100, 'TXN123')
    expect(a).toBe(b)
  })

  it('不同输入产生不同 ID', () => {
    const base = generateTransactionId('2026-07-05 14:30:00', 100, 'TXN123')
    const diffAmount = generateTransactionId('2026-07-05 14:30:00', 101, 'TXN123')
    const diffNo = generateTransactionId('2026-07-05 14:30:00', 100, 'TXN124')
    expect(base).not.toBe(diffAmount)
    expect(base).not.toBe(diffNo)
  })

  it('生成合法 UUID v5', () => {
    const id = generateTransactionId('2026-07-05', 50, 'abc')
    expect(id).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-5[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
    )
  })
})

describe('generateId', () => {
  it('确定性', () => {
    expect(generateId('hello')).toBe(generateId('hello'))
    expect(generateId('hello')).not.toBe(generateId('world'))
  })
})
