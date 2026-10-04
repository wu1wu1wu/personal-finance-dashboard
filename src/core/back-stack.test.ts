import { describe, it, expect, beforeEach } from 'vitest'
import { backHandlerCount, clearBackHandlers, consumeBack, pushBackHandler } from './back-stack'

/**
 * 返回键的消费栈：安卓原生按下返回键时先问 Web 层要不要这次返回
 * （弹窗、底部抽屉），没人要才退回 WebView 历史、最后才退出 App。
 *
 * 栈是模块级的，用例之间必须自己清干净，否则会互相干扰。
 */
beforeEach(clearBackHandlers)

describe('consumeBack', () => {
  it('没有处理器时返回 false（原生据此退回历史或退出 App）', () => {
    expect(consumeBack()).toBe(false)
  })

  it('有处理器时执行它并返回 true（原生据此什么都不做）', () => {
    let closed = 0
    pushBackHandler(() => {
      closed += 1
    })

    expect(consumeBack()).toBe(true)
    expect(closed).toBe(1)
  })
})

describe('后进先出', () => {
  it('先关最上面那一层（弹窗叠弹窗时不会把底下那层一起关掉）', () => {
    const order: string[] = []
    // 真实场景：处理器被消费 → 弹窗关闭 → 它在自己的卸载流程里注销
    let disposeTop: () => void = () => {}
    pushBackHandler(() => order.push('底'))
    disposeTop = pushBackHandler(() => {
      order.push('顶')
      disposeTop()
    })

    consumeBack()
    consumeBack()

    expect(order).toEqual(['顶', '底'])
    expect(backHandlerCount()).toBe(1)
  })

  it('没被关掉的处理器会继续守着（弹窗还开着，返回键就该继续找它）', () => {
    let called = 0
    pushBackHandler(() => {
      called += 1
    })

    consumeBack()
    consumeBack()

    expect(called).toBe(2)
  })

  it('栈空之后返回 false', () => {
    const dispose = pushBackHandler(() => {})
    dispose()

    expect(consumeBack()).toBe(false)
  })
})

describe('注销', () => {
  it('注销后不再被调用', () => {
    let called = 0
    const dispose = pushBackHandler(() => {
      called += 1
    })
    dispose()

    expect(consumeBack()).toBe(false)
    expect(called).toBe(0)
  })

  it('注销的是自己，不会误伤栈里的其他处理器', () => {
    let other = 0
    pushBackHandler(() => {
      other += 1
    })
    const dispose = pushBackHandler(() => {})
    dispose()

    expect(consumeBack()).toBe(true)
    expect(other).toBe(1)
  })

  it('重复注销是安全的（弹窗反复开关不会破坏栈）', () => {
    const dispose = pushBackHandler(() => {})
    const another = pushBackHandler(() => {})

    dispose()
    dispose()
    another()

    expect(backHandlerCount()).toBe(0)
  })
})
