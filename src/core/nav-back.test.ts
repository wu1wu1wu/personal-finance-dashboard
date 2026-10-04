import { describe, it, expect } from 'vitest'
import { resolveBackAction } from './nav-back'

/**
 * 页面头部的返回箭头：从父页点进来的就真回退（不新增历史），
 * 其余情况（深链、刷新、从别处进来）替换到父页，绝不留一条"点了返回却回不去"的历史。
 */
describe('resolveBackAction', () => {
  it('来源就是父页时真回退', () => {
    expect(resolveBackAction('/settings', '/settings')).toEqual({ type: 'pop' })
  })

  it('来源是别处时替换到父页', () => {
    expect(resolveBackAction('/report', '/settings')).toEqual({
      type: 'replace',
      to: '/settings',
    })
  })

  it('没有来源（深链或刷新）时替换到父页', () => {
    expect(resolveBackAction(undefined, '/settings')).toEqual({
      type: 'replace',
      to: '/settings',
    })
  })

  it('来源为空串也按没有来源处理', () => {
    expect(resolveBackAction('', '/settings/data')).toEqual({
      type: 'replace',
      to: '/settings/data',
    })
  })
})
