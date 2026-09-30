import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  DEFAULT_THEME_MODE,
  normalizeThemeMode,
  resolveTheme,
} from './theme'
import { applyThemeClass, readStoredThemeMode, THEME_CLASS } from './apply-theme'
import { STORAGE_KEYS } from '@/types'

describe('normalizeThemeMode', () => {
  it('没有值或非法值回落到跟随系统', () => {
    expect(normalizeThemeMode(undefined)).toBe(DEFAULT_THEME_MODE)
    expect(normalizeThemeMode(null)).toBe(DEFAULT_THEME_MODE)
    expect(normalizeThemeMode('blue')).toBe(DEFAULT_THEME_MODE)
    expect(normalizeThemeMode(42)).toBe(DEFAULT_THEME_MODE)
  })

  it('认识三种合法模式', () => {
    expect(normalizeThemeMode('system')).toBe('system')
    expect(normalizeThemeMode('light')).toBe('light')
    expect(normalizeThemeMode('dark')).toBe('dark')
  })
})

describe('resolveTheme', () => {
  it('跟随系统时看系统偏好', () => {
    expect(resolveTheme('system', true)).toBe('dark')
    expect(resolveTheme('system', false)).toBe('light')
  })

  it('手动指定时忽略系统偏好', () => {
    expect(resolveTheme('dark', false)).toBe('dark')
    expect(resolveTheme('light', true)).toBe('light')
  })
})

describe('applyThemeClass', () => {
  function fakeRoot() {
    const classes = new Set<string>()
    return {
      classes,
      classList: {
        add: (name: string) => void classes.add(name),
        remove: (name: string) => void classes.delete(name),
      },
    }
  }

  it('深色时加上 dark 类', () => {
    const root = fakeRoot()

    applyThemeClass('dark', root)

    expect(root.classes.has(THEME_CLASS)).toBe(true)
  })

  it('浅色时移除 dark 类', () => {
    const root = fakeRoot()
    applyThemeClass('dark', root)

    applyThemeClass('light', root)

    expect(root.classes.has(THEME_CLASS)).toBe(false)
  })
})

describe('readStoredThemeMode', () => {
  beforeEach(() => {
    vi.unstubAllGlobals()
  })

  it('同步读本地设置（首屏防闪要用，不能等异步 store）', () => {
    const data: Record<string, string> = {
      [STORAGE_KEYS.SETTINGS]: JSON.stringify({ themeMode: 'dark' }),
    }
    vi.stubGlobal('localStorage', { getItem: (k: string) => data[k] ?? null })

    expect(readStoredThemeMode()).toBe('dark')
  })

  it('没有存储或内容损坏时回落跟随系统', () => {
    vi.stubGlobal('localStorage', { getItem: () => '{不是 JSON' })

    expect(readStoredThemeMode()).toBe(DEFAULT_THEME_MODE)
  })

  it('没有 localStorage（原生端）时不报错', () => {
    vi.stubGlobal('localStorage', undefined)

    expect(readStoredThemeMode()).toBe(DEFAULT_THEME_MODE)
  })
})
