// ============================================================
// useBackHandler - 让当前这层界面「吃掉」一次系统返回
//
// 用法：弹窗、底部抽屉等临时界面在挂载时注册 onBack，
// 安卓返回键按下时（原生通过 window.__pfdHandleBack 问 Web 层）
// 就会执行它——表现和点关闭按钮一致，而不是退出整个 App。
// ============================================================

import { useEffect, useRef } from 'react';
import { pushBackHandler } from '@/core/back-stack';

export function useBackHandler(onBack: () => void): void {
  // 用 ref 拿最新回调：注册只做一次，避免父组件每次渲染都重注册
  const handlerRef = useRef(onBack);
  handlerRef.current = onBack;

  useEffect(() => {
    return pushBackHandler(() => handlerRef.current());
  }, []);
}
