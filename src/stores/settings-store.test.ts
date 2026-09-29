import { describe, it, expect, beforeEach, vi } from 'vitest'
import { normalizeSettings, useSettingsStore, DEFAULT_SETTINGS } from './settings-store'
import { flushPersist } from '@/storage/persist-queue'
import { STORAGE_KEYS } from '@/types'

function fakeLocalStorage() {
  const data: Record<string, string> = {}
  return {
    data,
    getItem: (k: string) => (k in data ? data[k] : null),
    setItem: (k: string, v: string) => void (data[k] = v),
    removeItem: (k: string) => void delete data[k],
    clear: () => Object.keys(data).forEach((k) => delete data[k]),
    key: (i: number) => Object.keys(data)[i] ?? null,
    get length() {
      return Object.keys(data).length
    },
  }
}

describe('normalizeSettings', () => {
  it('没有数据时用默认值（导入默认脱敏）', () => {
    expect(normalizeSettings(null)).toEqual(DEFAULT_SETTINGS)
    expect(DEFAULT_SETTINGS.importDesensitize).toBe(true)
  })

  it('保留用户关掉脱敏的选择', () => {
    expect(normalizeSettings({ importDesensitize: false })).toEqual({ importDesensitize: false })
  })

  it('字段类型不对时回落到默认值', () => {
    expect(normalizeSettings({ importDesensitize: 'no' })).toEqual(DEFAULT_SETTINGS)
  })
})

describe('settings-store', () => {
  beforeEach(() => {
    const fake = fakeLocalStorage()
    vi.stubGlobal('localStorage', fake)
    useSettingsStore.setState({ settings: DEFAULT_SETTINGS, loaded: false })
  })

  it('改动会写进存储，重新加载后还在', async () => {
    useSettingsStore.getState().setImportDesensitize(false)
    await flushPersist('settings')

    const saved = JSON.parse(
      (globalThis as unknown as { localStorage: { data: Record<string, string> } }).localStorage.data[
        STORAGE_KEYS.SETTINGS
      ],
    )
    expect(saved).toEqual({ importDesensitize: false })

    useSettingsStore.setState({ settings: DEFAULT_SETTINGS, loaded: false })
    await useSettingsStore.getState().loadFromStorage()

    expect(useSettingsStore.getState().settings.importDesensitize).toBe(false)
  })
})
