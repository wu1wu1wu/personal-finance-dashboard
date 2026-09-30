// ============================================================
// useVirtualList - 只渲染视口附近的列表行
//
// 行高不固定（有的行多一行「超过单笔上限」提示），所以：
//   1. 先按估算行高铺满滚动条（首屏不至于只看到两行）；
//   2. 渲染完用 offsetHeight 量一遍已渲染的行，写回高度表；
//   3. 高度表变了重算前缀和与窗口，几次之后收敛到真实高度。
//
// 行数少的时候直接全渲染：DOM 不多，还省掉一次测量。
// ============================================================

import { useCallback, useEffect, useMemo, useState } from 'react';
import { buildOffsets, findVirtualWindow } from '@/core/virtual-window';

export interface UseVirtualListOptions {
  /** 列表总行数 */
  itemCount: number;
  /** 还没测量时的行高估算值（px） */
  estimatedItemHeight: number;
  /** 超过这个行数才虚拟化 */
  threshold: number;
  /** 视口外上下各多渲染几行 */
  overscan?: number;
  /** 行间距（px）。space-y-2 这类外边距不在 offsetHeight 里，测量时要补上 */
  gap?: number;
}

export interface VirtualList {
  virtualized: boolean;
  startIndex: number;
  endIndex: number;
  offsetY: number;
  bottomHeight: number;
  totalHeight: number;
  /** 挂到列表容器（ul）上 */
  listRef: (node: HTMLElement | null) => void;
}

export function useVirtualList({
  itemCount,
  estimatedItemHeight,
  threshold,
  overscan = 4,
  gap = 8,
}: UseVirtualListOptions): VirtualList {
  const virtualized = itemCount > threshold;

  const [node, setNode] = useState<HTMLElement | null>(null);
  const [viewportHeight, setViewportHeight] = useState(0);
  const [scrollTop, setScrollTop] = useState(0);
  /** 每行的实际高度，长度对齐 itemCount */
  const [heights, setHeights] = useState<number[]>([]);

  const listRef = useCallback((next: HTMLElement | null) => {
    setNode(next);
  }, []);

  const estimatedTotal = estimatedItemHeight + gap;

  // 行数变化时对齐高度表：已量过的行保留，新行用估算值
  useEffect(() => {
    setHeights((previous) => {
      if (previous.length === itemCount) return previous;
      const next = new Array<number>(Math.max(0, itemCount));
      for (let i = 0; i < itemCount; i++) next[i] = previous[i] ?? estimatedTotal;
      return next;
    });
  }, [itemCount, estimatedTotal]);

  const offsets = useMemo(
    () =>
      buildOffsets(
        heights.length === itemCount
          ? heights
          : new Array<number>(Math.max(0, itemCount)).fill(estimatedTotal),
      ),
    [heights, itemCount, estimatedTotal],
  );

  const virtualWindow = useMemo(
    () =>
      virtualized
        ? findVirtualWindow({ offsets, scrollTop, viewportHeight, overscan })
        : {
            startIndex: 0,
            endIndex: itemCount,
            offsetY: 0,
            bottomHeight: 0,
            totalHeight: offsets[itemCount] ?? 0,
          },
    [virtualized, offsets, scrollTop, viewportHeight, overscan, itemCount],
  );

  // 监听窗口滚动/尺寸：整页滚动，所以算的是「列表顶部相对视口」的偏移
  useEffect(() => {
    if (!node || !virtualized) return;

    let frame = 0;
    const read = () => {
      frame = 0;
      const listTop = node.getBoundingClientRect().top + window.scrollY;
      setViewportHeight(window.innerHeight);
      setScrollTop(window.scrollY - listTop);
    };
    const schedule = () => {
      if (!frame) frame = window.requestAnimationFrame(read);
    };

    read();
    window.addEventListener('scroll', schedule, { passive: true });
    window.addEventListener('resize', schedule);
    return () => {
      if (frame) window.cancelAnimationFrame(frame);
      window.removeEventListener('scroll', schedule);
      window.removeEventListener('resize', schedule);
    };
  }, [node, virtualized, itemCount]);

  // 渲染后量一遍：只在真的有变化（>0.5px）时换新数组，
  // 否则测量与渲染会互相触发成死循环
  useEffect(() => {
    if (!node || !virtualized) return;

    const rows = Array.from(node.children);
    setHeights((previous) => {
      let changed = false;
      const next = previous.slice();

      rows.forEach((row, index) => {
        const target = virtualWindow.startIndex + index;
        if (target >= next.length) return;
        const measured = (row as HTMLElement).offsetHeight + gap;
        if (measured <= 0) return;
        if (Math.abs(next[target] - measured) > 0.5) {
          next[target] = measured;
          changed = true;
        }
      });

      return changed ? next : previous;
    });
  }, [node, virtualized, virtualWindow.startIndex, virtualWindow.endIndex, gap]);

  return {
    virtualized,
    startIndex: virtualWindow.startIndex,
    endIndex: virtualWindow.endIndex,
    offsetY: virtualWindow.offsetY,
    bottomHeight: virtualWindow.bottomHeight,
    totalHeight: virtualWindow.totalHeight,
    listRef,
  };
}
