import { describe, expect, it } from 'vitest';
import { buildOffsets, computeVirtualWindow, findVirtualWindow } from './virtual-window';

/** 固定行高的 offsets */
function uniformOffsets(count: number, height: number): number[] {
  return buildOffsets(new Array<number>(count).fill(height));
}

describe('buildOffsets', () => {
  it('前缀和比行数多一个，首项为 0', () => {
    expect(buildOffsets([10, 20, 30])).toEqual([0, 10, 30, 60]);
  });

  it('空列表得到 [0]', () => {
    expect(buildOffsets([])).toEqual([0]);
  });

  it('非法高度按 0 处理，不让前缀和倒挂', () => {
    expect(buildOffsets([10, -5, Number.NaN, 20])).toEqual([0, 10, 10, 10, 30]);
  });
});

describe('findVirtualWindow', () => {
  it('行数为 0 时窗口为空', () => {
    const win = findVirtualWindow({ offsets: [0], scrollTop: 100, viewportHeight: 500 });

    expect(win).toEqual({
      startIndex: 0,
      endIndex: 0,
      offsetY: 0,
      bottomHeight: 0,
      totalHeight: 0,
    });
  });

  it('在顶部时从第 0 行开始，且带上 overscan', () => {
    const win = findVirtualWindow({
      offsets: uniformOffsets(100, 50),
      scrollTop: 0,
      viewportHeight: 200,
      overscan: 2,
    });

    expect(win.startIndex).toBe(0);
    // 视口能装 4 行 + 1 行边界，再加 2 行 overscan
    expect(win.endIndex).toBe(7);
    expect(win.offsetY).toBe(0);
    expect(win.totalHeight).toBe(5000);
    expect(win.bottomHeight).toBe(5000 - 7 * 50);
  });

  it('滚到中间时窗口跟着走，上下留白对得上', () => {
    const win = findVirtualWindow({
      offsets: uniformOffsets(100, 50),
      scrollTop: 1000,
      viewportHeight: 200,
      overscan: 2,
    });

    expect(win.startIndex).toBe(18); // 1000/50 = 20，再减 2 行 overscan
    expect(win.endIndex).toBe(27);
    expect(win.offsetY).toBe(18 * 50);
    expect(win.offsetY + (win.endIndex - win.startIndex) * 50 + win.bottomHeight).toBe(
      win.totalHeight,
    );
  });

  it('滚到底时窗口贴住末尾，不会渲染出空白', () => {
    const win = findVirtualWindow({
      offsets: uniformOffsets(100, 50),
      scrollTop: 5000,
      viewportHeight: 200,
      overscan: 2,
    });

    expect(win.endIndex).toBe(100);
    expect(win.bottomHeight).toBe(0);
  });

  it('筛选后行数变少、滚动位置却还在下面时，收敛到最后一屏', () => {
    const win = findVirtualWindow({
      offsets: uniformOffsets(5, 50),
      scrollTop: 99999,
      viewportHeight: 200,
      overscan: 1,
    });

    expect(win.endIndex).toBe(5);
    expect(win.startIndex).toBeLessThan(5);
    expect(win.startIndex + (win.endIndex - win.startIndex)).toBe(5);
  });

  it('视口比内容还高时全部渲染', () => {
    const win = findVirtualWindow({
      offsets: uniformOffsets(3, 50),
      scrollTop: 0,
      viewportHeight: 1000,
      overscan: 4,
    });

    expect(win.startIndex).toBe(0);
    expect(win.endIndex).toBe(3);
  });

  it('超高行也要被包含进来（行高不一致时不能漏行）', () => {
    // 第 2 行高 500，视口 200：它应该完整地落在窗口里
    const offsets = buildOffsets([50, 50, 500, 50, 50]);
    const win = findVirtualWindow({ offsets, scrollTop: 100, viewportHeight: 200, overscan: 0 });

    expect(win.startIndex).toBeLessThanOrEqual(2);
    expect(win.endIndex).toBeGreaterThan(2);
    expect(win.offsetY).toBe(offsets[win.startIndex]);
    expect(win.bottomHeight).toBe(offsets[5] - offsets[win.endIndex]);
  });

  it('负的 scrollTop 与负 overscan 都被收敛', () => {
    const win = findVirtualWindow({
      offsets: uniformOffsets(10, 50),
      scrollTop: -500,
      viewportHeight: 200,
      overscan: -3,
    });

    expect(win.startIndex).toBe(0);
    expect(win.offsetY).toBe(0);
  });

  it('窗口连续覆盖：滚动过程中不会跳行', () => {
    const offsets = uniformOffsets(50, 40);
    let previousEnd = 0;

    for (let scrollTop = 0; scrollTop <= 2000; scrollTop += 10) {
      const win = findVirtualWindow({ offsets, scrollTop, viewportHeight: 200, overscan: 1 });
      // 与上一个窗口必须有重叠（连续），否则会出现空白
      expect(win.startIndex).toBeLessThanOrEqual(previousEnd);
      expect(win.endIndex).toBeGreaterThan(win.startIndex);
      previousEnd = win.endIndex;
    }
  });
});

describe('computeVirtualWindow', () => {
  it('固定行高时等价于手工计算', () => {
    const win = computeVirtualWindow({
      itemCount: 20,
      itemHeight: 60,
      scrollTop: 600,
      viewportHeight: 300,
      overscan: 0,
    });

    expect(win).toEqual({
      startIndex: 10,
      endIndex: 16,
      offsetY: 600,
      bottomHeight: 20 * 60 - 16 * 60,
      totalHeight: 1200,
    });
  });

  it('行数为 0 或负数时不炸', () => {
    expect(
      computeVirtualWindow({ itemCount: 0, itemHeight: 60, scrollTop: 0, viewportHeight: 300 })
        .totalHeight,
    ).toBe(0);
    expect(
      computeVirtualWindow({ itemCount: -5, itemHeight: 60, scrollTop: 0, viewportHeight: 300 })
        .endIndex,
    ).toBe(0);
  });
});
