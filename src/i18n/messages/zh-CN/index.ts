// ============================================================
// 中文文案（默认语言，也是「哪些 key 存在」的唯一事实来源）
//
// 每个命名空间一个文件：页面翻译时只改自己那一份，
// 不要往别人的文件里塞 key，避免并行改动互相冲突。
// 新增命名空间时记得同时改 ./index.ts 与 ../../en 的对应文件。
// ============================================================

import { billImport } from './billImport';
import { budget } from './budget';
import { charts } from './charts';
import { common } from './common';
import { dashboard } from './dashboard';
import { dataLabels } from './dataLabels';
import { nav } from './nav';
import { periodic } from './periodic';
import { pwa } from './pwa';
import { recurring } from './recurring';
import { report } from './report';
import { settings } from './settings';
import { settingsData } from './settingsData';
import { settingsRules } from './settingsRules';
import { theme } from './theme';
import { transactions } from './transactions';

export const zhCN = {
  ...common,
  ...nav,
  ...dataLabels,
  ...theme,
  ...dashboard,
  ...transactions,
  ...budget,
  ...settings,
  ...settingsData,
  ...settingsRules,
  ...periodic,
  ...report,
  ...recurring,
  ...billImport,
  ...pwa,
  ...charts,
} as const;

/** 所有存在的文案 key。拼错 key 时 tsc 会直接报错 */
export type MessageKey = keyof typeof zhCN;

export {
  billImport,
  budget,
  charts,
  common,
  dashboard,
  dataLabels,
  nav,
  periodic,
  pwa,
  recurring,
  report,
  settings,
  settingsData,
  settingsRules,
  theme,
  transactions,
};
