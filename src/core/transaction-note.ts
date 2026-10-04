// ============================================================
// 手记 - 一笔账单上的「一句话 + 一张图」
//
// 存储字段沿用旧名（theme / coverImage），界面上一律叫「手记」：
// 改名要写数据迁移，风险大、收益小，所以在类型与 store 上注明即可。
//
// 判断与清洗都是纯函数：卡片陈列与「移出手记」必须共用同一个口径，
// 之前带图卡片删不掉的 bug，就出在这条判断散落在页面里、还跟 ✕ 的行为对不上。
// ============================================================

import type { Transaction } from '@/types';

/** 手记文字上限：卡片上最多显示三行，再长也看不全 */
export const NOTE_MAX_LENGTH = 80;

/** 有手记文字（非纯空白）或配图，才算一条手记 */
export function hasNoteCard(txn: Pick<Transaction, 'theme' | 'coverImage'>): boolean {
  return Boolean((txn.theme || '').trim() || txn.coverImage);
}

/** 手记写入库里的格式：去掉首尾空白，超长截断 */
export function normalizeNote(raw: string): string {
  return (raw || '').trim().slice(0, NOTE_MAX_LENGTH);
}

/** 一次清空手记：文字与配图一起清（卡片随之消失） */
export function clearedNotePatch(): Pick<Transaction, 'theme' | 'coverImage'> {
  return { theme: '', coverImage: '' };
}
