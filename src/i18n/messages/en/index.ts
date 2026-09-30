// ============================================================
// English messages.
//
// 这里用 Record<keyof typeof zhXxx, string> 标注：
// 中文加了 key 却没补英文，tsc 会直接报错（多写一个也会报）。
// ============================================================

import type { MessageKey } from '../zh-CN';
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

export const en: Record<MessageKey, string> = {
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
};
