import { describe, it, expect } from 'vitest'
import { isShareCanceled } from './backup-save'

/**
 * 用户点「分享」面板的取消，Share 插件会以 reject 的形式抛出来。
 * 这种情况不能当导出失败提示——用户只是不想导。
 */
describe('isShareCanceled', () => {
  it('认得出插件原样的取消文案', () => {
    expect(isShareCanceled(new Error('Share canceled'))).toBe(true)
  })

  it('英美拼法都认', () => {
    expect(isShareCanceled(new Error('Share cancelled'))).toBe(true)
  })

  it('不是 Error 的字符串也认', () => {
    expect(isShareCanceled('Share canceled')).toBe(true)
  })

  it('插件抛的其他错误不算取消', () => {
    expect(isShareCanceled(new Error('Must provide a URL or Message or files'))).toBe(false)
    expect(isShareCanceled(new Error('Can\'t share while sharing is in progress'))).toBe(false)
  })

  it('写文件失败之类的真错误不算取消', () => {
    expect(isShareCanceled(new Error('Permission denied'))).toBe(false)
    expect(isShareCanceled(new Error('ENOSPC: no space left on device'))).toBe(false)
  })

  it('空值与空串不算取消', () => {
    expect(isShareCanceled(null)).toBe(false)
    expect(isShareCanceled(undefined)).toBe(false)
    expect(isShareCanceled('')).toBe(false)
    expect(isShareCanceled(new Error(''))).toBe(false)
  })
})
