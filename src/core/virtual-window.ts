// ============================================================
// 列表窗口计算（虚拟化的纯逻辑部分）
//
// 明细页可能有上万条记录。以前是「先渲染 20 条，滚到底再加载 20 条」，
// 结果 DOM 会一直长下去；现在改成只渲染视口附近的一段，滚动时替换窗口。
//
// 这一层不碰 DOM：给一组行高算出「该渲染哪几行、上下留多少空白」。
// 行高允许不一样（有的行多一行「超过单笔上限」提示），所以用前缀和 + 二分。
// ============================================================

/** 计算出的窗口 */
export interface VirtualWindow {
  /** 起始行（含） */
  startIndex: number;
  /** 结束行（不含） */
  endIndex: number;
  /** 窗口上方需要占位的高度 */
  offsetY: number;
  /** 窗口下方需要占位的高度 */
  bottomHeight: number;
  /** 全部内容的总高度 */
  totalHeight: number;
}

/** 高度前缀和：offsets[i] 是第 i 行之前的总高度，长度是 itemCount + 1 */
export function buildOffsets(heights: readonly number[]): number[] {
  const offsets = new Array<number>(heights.length + 1);
  offsets[0] = 0;
  for (let i = 0; i < heights.length; i++) {
    // 负数高度没有意义，按 0 处理，避免前缀和倒挂导致二分错乱
    offsets[i + 1] = offsets[i] + Math.max(0, heights[i] || 0);
  }
  return offsets;
}

/** 二分：最后一个 offset <= value 的下标（value 小于 0 时返回 -1） */
function lastIndexAtMost(offsets: readonly number[], value: number): number {
  let low = 0;
  let high = offsets.length - 1;
  let result = -1;
  while (low <= high) {
    const mid = (low + high) >> 1;
    if (offsets[mid] <= value) {
      result = mid;
      low = mid + 1;
    } else {
      high = mid - 1;
    }
  }
  return result;
}

export interface VirtualWindowInput {
  /** buildOffsets 的结果（长度 = 行数 + 1） */
  offsets: readonly number[];
  /** 列表内容顶部相对滚动容器可视区顶部的偏移（负数=往上滚过头了） */
  scrollTop: number;
  /** 可视区高度 */
  viewportHeight: number;
  /** 视口上下各多渲染几行，滚动时不至于看到空白 */
  overscan?: number;
}

/**
 * 算出该渲染的窗口。
 *
 * 三个边界一定要稳：
 * - 行数为 0 → 空窗口
 * - 滚过头（筛选后行数变少、或惯性滚动超出）→ 收敛到最后一屏，不能渲染出空白
 * - 视口比内容高 → 全部渲染
 */
export function findVirtualWindow({
  offsets,
  scrollTop,
  viewportHeight,
  overscan = 4,
}: VirtualWindowInput): VirtualWindow {
  const itemCount = Math.max(0, offsets.length - 1);
  const totalHeight = offsets[itemCount] ?? 0;

  if (itemCount === 0) {
    return { startIndex: 0, endIndex: 0, offsetY: 0, bottomHeight: 0, totalHeight: 0 };
  }

  const safeViewport = Math.max(0, viewportHeight);
  const safeOverscan = Math.max(0, Math.floor(overscan));
  // 允许最多滚到「最后一屏的顶部」，再往下就没有内容可显示了
  const maxScrollTop = Math.max(0, totalHeight - safeViewport);
  const clampedScrollTop = Math.min(Math.max(0, scrollTop), maxScrollTop);

  const firstVisible = Math.max(0, lastIndexAtMost(offsets, clampedScrollTop));
  const lastVisible = Math.max(
    firstVisible,
    lastIndexAtMost(offsets, clampedScrollTop + safeViewport),
  );

  const startIndex = Math.max(0, firstVisible - safeOverscan);
  // lastIndexAtMost 给的是「这一行还在视口里」，所以窗口右开边界要 +1
  const endIndex = Math.min(itemCount, lastVisible + 1 + safeOverscan);

  return {
    startIndex,
    endIndex,
    offsetY: offsets[startIndex],
    bottomHeight: totalHeight - offsets[endIndex],
    totalHeight,
  };
}

/** 固定行高的便捷版本（测试与简单场景用；真实列表走 buildOffsets + findVirtualWindow） */
export function computeVirtualWindow(input: {
  itemCount: number;
  itemHeight: number;
  scrollTop: number;
  viewportHeight: number;
  overscan?: number;
}): VirtualWindow {
  const { itemCount, itemHeight, ...rest } = input;
  const heights = new Array<number>(Math.max(0, itemCount)).fill(Math.max(0, itemHeight));
  return findVirtualWindow({ offsets: buildOffsets(heights), ...rest });
}
