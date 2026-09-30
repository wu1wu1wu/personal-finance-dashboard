// ============================================================
// ECharts 按需注册
//
// 整包 echarts 有 1.1MB，而项目只用到折线、柱状、环形三种图。
// 这里只注册用得到的图表与组件，产物因此小一大截。
//
// 新增图表类型时记得在这里补注册，并让 chart-options.test.ts 覆盖到
// —— 漏注册不会报错，只会静默少画东西。
// ============================================================

import * as echarts from 'echarts/core';
import { BarChart, LineChart, PieChart } from 'echarts/charts';
import {
  GridComponent,
  LegendComponent,
  MarkLineComponent,
  TooltipComponent,
} from 'echarts/components';
import { SVGRenderer } from 'echarts/renderers';
import type { ComposeOption } from 'echarts/core';
import type { BarSeriesOption, LineSeriesOption, PieSeriesOption } from 'echarts/charts';
import type {
  GridComponentOption,
  LegendComponentOption,
  MarkLineComponentOption,
  TooltipComponentOption,
} from 'echarts/components';

echarts.use([
  PieChart,
  LineChart,
  BarChart,
  TooltipComponent,
  LegendComponent,
  GridComponent,
  // 每日支出图的「日均」参考线依赖它
  MarkLineComponent,
  SVGRenderer,
]);

/** 项目用到的 option 类型（只包含已注册的图表与组件） */
export type ChartOption = ComposeOption<
  | PieSeriesOption
  | LineSeriesOption
  | BarSeriesOption
  | TooltipComponentOption
  | LegendComponentOption
  | GridComponentOption
  | MarkLineComponentOption
>;

export { echarts };
