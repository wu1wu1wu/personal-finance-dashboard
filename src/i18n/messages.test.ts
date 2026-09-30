import { readFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { LOCALES } from './locale';
import { MESSAGES } from './messages';
import * as zhNamespaces from './messages/zh-CN';

const SRC = path.resolve(process.cwd(), 'src');
const DEFAULT_DICT = MESSAGES['zh-CN'];

/**
 * 命名空间列表直接从模块里取，不手写枚举：
 * 新加一个命名空间时忘了改这里，重复 key / 总数对不上这类问题就会漏检。
 */
const NAMESPACES = Object.entries(zhNamespaces).filter(
  ([name]) => name !== 'zhCN',
) as [string, Record<string, string>][];

/** 递归收集待扫描的源码文件（测试文件本身会故意写不存在的 key，排除掉） */
function collectSourceFiles(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const full = path.join(dir, entry);
    if (statSync(full).isDirectory()) {
      collectSourceFiles(full, out);
    } else if (/\.tsx?$/.test(entry) && !/\.test\.tsx?$/.test(entry)) {
      out.push(full);
    }
  }
  return out;
}

/** 源码里出现的所有文案 key */
function usedKeys(): { key: string; file: string }[] {
  const found: { key: string; file: string }[] = [];
  const patterns = [
    /(?<![\w$.])t\(\s*'([^']+)'/g, // t('a.b')
    /\btranslateIn\(\s*[^,()]+,\s*'([^']+)'/g, // translateIn(locale, 'a.b')
  ];

  for (const file of collectSourceFiles(SRC)) {
    // 注释里会写示例（例如 t('x')），先去掉块注释与整行注释再扫
    const text = readFileSync(file, 'utf8')
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/^\s*\/\/.*$/gm, '');
    for (const pattern of patterns) {
      pattern.lastIndex = 0;
      let match: RegExpExecArray | null;
      while ((match = pattern.exec(text)) !== null) {
        found.push({ key: match[1], file: path.relative(SRC, file) });
      }
    }
  }
  return found;
}

/** 文案里的 {占位符} 集合 */
function placeholders(message: string): string[] {
  return [...message.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort();
}

describe('文案字典完整性', () => {
  it('每种语言的 key 集合与默认语言完全一致', () => {
    const expected = Object.keys(DEFAULT_DICT).sort();
    for (const locale of LOCALES) {
      expect({ locale, keys: Object.keys(MESSAGES[locale]).sort() }).toEqual({
        locale,
        keys: expected,
      });
    }
  });

  it('命名空间之间没有重复 key（重复会被对象展开悄悄覆盖）', () => {
    const all = NAMESPACES.flatMap(([, ns]) => Object.keys(ns));
    expect(new Set(all).size).toBe(all.length);
    expect(all.length).toBe(Object.keys(DEFAULT_DICT).length);
    // 命名空间一个都不能漏：聚合对象里除了 zhCN 之外都应该被数到
    expect(NAMESPACES.length).toBeGreaterThan(10);
    expect(all).toContain('charts.expense');
  });

  it('没有空文案，也没有多余的首尾空格', () => {
    // 分隔符是唯一允许带空格的：中文用「，」、英文用「, 」，句尾本来就有空格
    const allowsWhitespace = (key: string) => key.toLowerCase().endsWith('separator');

    for (const locale of LOCALES) {
      for (const [key, value] of Object.entries(MESSAGES[locale])) {
        expect({ locale, key, value: value.length > 0 }).toEqual({ locale, key, value: true });
        if (!allowsWhitespace(key)) {
          expect({ locale, key, value }).toEqual({ locale, key, value: value.trim() });
        }
      }
    }
  });

  it('中英文的占位符必须一致（否则英文会漏参数）', () => {
    for (const key of Object.keys(DEFAULT_DICT)) {
      expect({ key, ph: placeholders(MESSAGES.en[key]) }).toEqual({
        key,
        ph: placeholders(DEFAULT_DICT[key]),
      });
    }
  });
});

/** 带 count 调用时可以用复数变体的基名（billImport.result.added → _one / _other） */
function pluralBases(): string[] {
  return Object.keys(DEFAULT_DICT)
    .map((key) => key.match(/^(.*)_(one|other)$/)?.[1])
    .filter((key): key is string => Boolean(key));
}

describe('源码里用到的 key 都存在', () => {
  it('t(...) / translateIn(...) 的字面量 key 都能在字典里找到', () => {
    const allowed = new Set([...Object.keys(DEFAULT_DICT), ...pluralBases()]);
    const missing = usedKeys().filter(({ key }) => !allowed.has(key));
    expect(missing).toEqual([]);
  });

  it('扫描确实找到了 key（别让正则失效导致这个测试永远通过）', () => {
    const keys = usedKeys();
    expect(keys.length).toBeGreaterThan(0);
    // 抽查：导航标题一定被引用过
    expect(keys.some(({ key }) => key.startsWith('nav.'))).toBe(true);
  });
});
