import { describe, expect, it } from 'vitest';
import {
  NOTE_MAX_LENGTH,
  clearedNotePatch,
  hasNoteCard,
  normalizeNote,
} from './transaction-note';

describe('hasNoteCard', () => {
  it('写了手记就算一条', () => {
    expect(hasNoteCard({ theme: '和朋友的晚餐', coverImage: '' })).toBe(true);
  });

  it('只有配图也算一条', () => {
    expect(hasNoteCard({ theme: '', coverImage: 'data:image/jpeg;base64,AAAA' })).toBe(true);
  });

  it('文字和配图都有，仍然只算一条', () => {
    expect(hasNoteCard({ theme: '聚餐', coverImage: 'data:image/jpeg;base64,AAAA' })).toBe(true);
  });

  it('都没有就不是手记（卡片不该陈列）', () => {
    expect(hasNoteCard({ theme: '', coverImage: '' })).toBe(false);
  });

  it('只有空格的手记等于没写（老数据里可能有）', () => {
    expect(hasNoteCard({ theme: '   ', coverImage: '' })).toBe(false);
  });
});

describe('normalizeNote', () => {
  it('去掉首尾空白', () => {
    expect(normalizeNote('  和朋友的晚餐  ')).toBe('和朋友的晚餐');
  });

  it('超长按上限截断（卡片上最多三行，再长也看不全）', () => {
    const long = '记'.repeat(NOTE_MAX_LENGTH + 20);
    expect(normalizeNote(long)).toHaveLength(NOTE_MAX_LENGTH);
  });

  it('刚好到上限不动它', () => {
    const exact = 'a'.repeat(NOTE_MAX_LENGTH);
    expect(normalizeNote(exact)).toBe(exact);
  });

  it('空串与纯空白都算空手记', () => {
    expect(normalizeNote('')).toBe('');
    expect(normalizeNote('   ')).toBe('');
  });

  it('中间的空白与换行保留原样', () => {
    expect(normalizeNote('  和朋友的晚餐 聊到很晚 ')).toBe('和朋友的晚餐 聊到很晚');
  });
});

describe('clearedNotePatch', () => {
  it('文字与配图一起清（只清文字的话，带图卡片会删不掉）', () => {
    expect(clearedNotePatch()).toEqual({ theme: '', coverImage: '' });
  });
});
