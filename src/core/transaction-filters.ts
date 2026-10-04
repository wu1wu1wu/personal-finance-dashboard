// ============================================================
// 明细页筛选条件 ↔ URL 参数
//
// 筛选状态放进 URL 的三个好处：刷新/返回不丢、能把当前视图发给别人、
// 看板钻取进来的 ?category= / ?pending=1 / ?id= 与筛选走同一套解析。
//
// 纯函数，便于单测：非法值一律回落到默认值，绝不把脏参数带进查询。
// ============================================================

import type { DirectionFilter, SortKey } from '@/core/transaction-query';

export interface TransactionFilterState {
  /** 分类筛选（待确认收件箱优先，此时它被忽略） */
  category: string;
  /** 待确认收件箱模式 */
  pendingOnly: boolean;
  /** 月份键 "2026-09"，空 = 全部月份 */
  month: string;
  /** 收支方向 */
  direction: DirectionFilter;
  /** 排序方式 */
  sort: SortKey;
  /** 搜索关键词 */
  keyword: string;
  /** 金额区间输入（原始字符串，页面直接绑到输入框） */
  minAmount: string;
  maxAmount: string;
  /** 深链：直接打开某笔详情 */
  deepLinkId: string | null;
}

export const DEFAULT_FILTERS: TransactionFilterState = {
  category: '',
  pendingOnly: false,
  month: '',
  direction: 'all',
  sort: 'time-desc',
  keyword: '',
  minAmount: '',
  maxAmount: '',
  deepLinkId: null,
};

const DIRECTIONS: DirectionFilter[] = ['all', 'expense', 'income'];
const SORTS: SortKey[] = ['time-desc', 'time-asc', 'amount-desc', 'amount-asc'];

/** 关键词与金额输入的长度上限：URL 不该被粘贴进来的长文本撑爆 */
const MAX_KEYWORD_LENGTH = 50;

/** 月份键必须形如 2026-09，否则会被当成前缀去匹配交易时间 */
function validMonth(value: string | null): string {
  return value && /^\d{4}-(0[1-9]|1[0-2])$/.test(value) ? value : '';
}

/** 金额区间：只接受非负数字 */
function validAmount(value: string | null): string {
  if (!value) return '';
  const num = Number(value);
  return Number.isFinite(num) && num >= 0 ? String(num) : '';
}

/**
 * 在已有筛选基础上合并改动，并序列化成 URL 参数。
 * 默认值不写进 URL，保持链接干净。
 */
export function mergeFilterParams(
  current: TransactionFilterState,
  patch: Partial<TransactionFilterState>,
): URLSearchParams {
  const next: TransactionFilterState = { ...current, ...patch };
  const params = new URLSearchParams();

  // 待确认收件箱与分类筛选互斥：收件箱模式下不带 category
  if (next.pendingOnly) {
    params.set('pending', '1');
  } else if (next.category) {
    params.set('category', next.category);
  }

  if (next.month) params.set('month', next.month);
  if (next.direction !== DEFAULT_FILTERS.direction) params.set('direction', next.direction);
  if (next.sort !== DEFAULT_FILTERS.sort) params.set('sort', next.sort);

  const keyword = next.keyword.trim();
  if (keyword) params.set('q', keyword.slice(0, MAX_KEYWORD_LENGTH));
  if (next.minAmount) params.set('min', next.minAmount);
  if (next.maxAmount) params.set('max', next.maxAmount);
  if (next.deepLinkId) params.set('id', next.deepLinkId);

  return params;
}

/** 从 URL 参数解析出筛选状态（非法值回落默认） */
export function parseFilterParams(params: URLSearchParams): TransactionFilterState {
  const direction = params.get('direction') as DirectionFilter | null;
  const sort = params.get('sort') as SortKey | null;

  return {
    category: params.get('category') ?? '',
    pendingOnly: params.get('pending') === '1',
    month: validMonth(params.get('month')),
    direction: direction && DIRECTIONS.includes(direction) ? direction : DEFAULT_FILTERS.direction,
    sort: sort && SORTS.includes(sort) ? sort : DEFAULT_FILTERS.sort,
    keyword: (params.get('q') ?? '').slice(0, MAX_KEYWORD_LENGTH),
    minAmount: validAmount(params.get('min')),
    maxAmount: validAmount(params.get('max')),
    deepLinkId: params.get('id'),
  };
}

/**
 * 是否用到了「高级条件」：收支方向、排序、金额区间。
 *
 * 明细页把这三项收在默认折叠的面板里——它们不是天天要调的东西，
 * 常驻会把半屏让给筛选；但深链带进来时必须自动展开，否则用户看不见生效的条件。
 * 分类 / 待确认 / 月份 / 关键词不算：它们各自有常驻入口，收起面板也不影响。
 */
export function hasAdvancedFilters(state: TransactionFilterState): boolean {
  return (
    state.direction !== DEFAULT_FILTERS.direction ||
    state.sort !== DEFAULT_FILTERS.sort ||
    Boolean(state.minAmount) ||
    Boolean(state.maxAmount)
  );
}

/** 当前生效的条件个数（筛选按钮上的角标） */
export function countActiveFilters(state: TransactionFilterState): number {
  let count = 0;
  // 分类与待确认收件箱互斥，算同一项
  if (state.pendingOnly || state.category) count += 1;
  if (state.month) count += 1;
  if (state.keyword.trim()) count += 1;
  if (state.direction !== DEFAULT_FILTERS.direction) count += 1;
  if (state.sort !== DEFAULT_FILTERS.sort) count += 1;
  if (state.minAmount) count += 1;
  if (state.maxAmount) count += 1;
  return count;
}
