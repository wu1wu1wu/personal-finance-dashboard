import { beforeEach, describe, expect, it, vi } from 'vitest';
import { normalizeIgnored, useRecurringStore } from './recurring-store';
import { flushPersist } from '@/storage/persist-queue';
import { STORAGE_KEYS } from '@/types';

function fakeLocalStorage() {
  const data: Record<string, string> = {};
  return {
    data,
    getItem: (k: string) => (k in data ? data[k] : null),
    setItem: (k: string, v: string) => void (data[k] = v),
    removeItem: (k: string) => void delete data[k],
    clear: () => Object.keys(data).forEach((k) => delete data[k]),
    key: (i: number) => Object.keys(data)[i] ?? null,
    get length() {
      return Object.keys(data).length;
    },
  };
}

function readStored(): unknown {
  const raw = (
    globalThis as unknown as { localStorage: { data: Record<string, string> } }
  ).localStorage.data[STORAGE_KEYS.RECURRING_IGNORED];
  return JSON.parse(raw);
}

describe('normalizeIgnored', () => {
  it('不是数组时返回空列表', () => {
    expect(normalizeIgnored(null)).toEqual([]);
    expect(normalizeIgnored('奈飞')).toEqual([]);
    expect(normalizeIgnored({ a: 1 })).toEqual([]);
  });

  it('丢掉非字符串、空串与重复项，并去掉首尾空格', () => {
    expect(normalizeIgnored([' 奈飞 ', '奈飞', '', 42, null, 'Spotify', 'Spotify '])).toEqual([
      '奈飞',
      'Spotify',
    ]);
  });

  it('保留顺序', () => {
    expect(normalizeIgnored(['b', 'a'])).toEqual(['b', 'a']);
  });
});

describe('recurring-store', () => {
  beforeEach(() => {
    vi.stubGlobal('localStorage', fakeLocalStorage());
    useRecurringStore.setState({ ignored: [], loaded: false });
  });

  it('忽略一个商户后会落盘，重新加载还在', async () => {
    useRecurringStore.getState().ignore(' 奈飞 ');
    await flushPersist('recurring');

    expect(readStored()).toEqual(['奈飞']);

    useRecurringStore.setState({ ignored: [], loaded: false });
    await useRecurringStore.getState().loadFromStorage();

    expect(useRecurringStore.getState().ignored).toEqual(['奈飞']);
  });

  it('重复忽略同一个商户不会写两条', () => {
    useRecurringStore.getState().ignore('奈飞');
    useRecurringStore.getState().ignore('奈飞');
    expect(useRecurringStore.getState().ignored).toEqual(['奈飞']);
  });

  it('空商户名不记录', () => {
    useRecurringStore.getState().ignore('   ');
    expect(useRecurringStore.getState().ignored).toEqual([]);
  });

  it('恢复单个与清空全部都能落盘', async () => {
    useRecurringStore.getState().ignore('奈飞');
    useRecurringStore.getState().ignore('Spotify');
    useRecurringStore.getState().restore('奈飞');
    expect(useRecurringStore.getState().ignored).toEqual(['Spotify']);

    useRecurringStore.getState().clearIgnored();
    await flushPersist('recurring');
    expect(readStored()).toEqual([]);
  });

  it('读到的坏数据会被清洗', async () => {
    (globalThis as unknown as { localStorage: { data: Record<string, string> } }).localStorage.data[
      STORAGE_KEYS.RECURRING_IGNORED
    ] = JSON.stringify(['奈飞', '奈飞', 7, '']);

    await useRecurringStore.getState().loadFromStorage();

    expect(useRecurringStore.getState().ignored).toEqual(['奈飞']);
  });
});
