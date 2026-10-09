// ============================================================
// EChart - 项目统一的图表组件
//
// 基于 echarts/core + 按需注册（见 register.ts），替代直接引整包 echarts 的
// echarts-for-react，产物因此小很多。对外接口与原用法一致：
// <EChart option={...} style={...} onEvents={...} />
// ============================================================

// 必须用 esm/ 这一份：lib/core.js 是 CJS（exports.default = 组件），
// 打包器给 default 的是那个模块对象，React 会当成非法元素类型直接抛 #130
// （「Element type is invalid ... but got: object」）。
// 之前用 'echarts-for-react' 包根入口能work，是因为 package.json 的 module 字段指向 esm/index.js。
import ReactEChartsCore from 'echarts-for-react/esm/core';
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
