// ============================================================
// useBackTo - 页面头部返回箭头的点击处理
//
// 从父页点进来的（location.state.from 与 backTo 一致）走真回退，
// 不新增历史；其余情况（深链、刷新、从别处进来）替换到父页。
// 判断逻辑在 core/nav-back.ts 里，有单测。
// ============================================================

import { useCallback } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { resolveBackAction } from '@/core/nav-back';

/** 路由 state 里记录来源页的字段 */
export interface BackFromState {
  from?: string;
}

export function useBackTo(backTo: string): () => void {
  const navigate = useNavigate();
  const location = useLocation();
  const from = (location.state as BackFromState | null)?.from;

  return useCallback(() => {
    const action = resolveBackAction(from, backTo);
    if (action.type === 'pop') {
      navigate(-1);
    } else {
      // 替换而不是新增：否则「点返回却回不去」的历史会越攒越多
      navigate(action.to, { replace: true });
    }
  }, [from, backTo, navigate]);
}
