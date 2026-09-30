// ============================================================
// EChart - 项目统一的图表组件
//
// 基于 echarts/core + 按需注册（见 register.ts），替代直接引整包 echarts 的
// echarts-for-react，产物因此小很多。对外接口与原用法一致：
// <EChart option={...} style={...} onEvents={...} />
// ============================================================

import ReactEChartsCore from 'echarts-for-react/lib/core';
import { echarts } from '@/components/charts/register';
import type { ChartOption } from '@/components/charts/register';

interface EChartProps {
  option: ChartOption;
  style?: React.CSSProperties;
  /** 图表事件的回调，如 { click: handler }（分类钻取用到） */
  onEvents?: Record<string, (params: never) => void>;
}

export default function EChart({ option, style, onEvents }: EChartProps) {
  return (
    <ReactEChartsCore
      echarts={echarts}
      option={option}
      style={style}
      onEvents={onEvents}
      opts={{ renderer: 'svg' }}
    />
  );
}
