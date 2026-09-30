// ============================================================
// 月度报告要点（纯函数）
//
// 报告页顶部的「本月要点」不是另算一套数，而是把 report-engine 的结果
// 翻译成人话。这里只产出「文案 key + 参数」，不产出字符串，
// 所以中英文都走同一套判断逻辑，测试也不必跟着文案改。
// ============================================================

import type { MonthlyReport } from '@/core/report-engine';
import { categoryLabel } from '@/i18n/labels';
import type { Locale } from '@/i18n/locale';
import type { MessageKey, TranslateParams } from '@/i18n';
import { formatCurrency } from '@/utils/format';

/** 一条要点：文案 key + 待插值的参数 */
export interface ReportInsight {
  key: MessageKey;
  params?: TranslateParams;
}

/** 环比变化小于这个百分比就当作「持平」 */
const FLAT_THRESHOLD = 1;

/** 预算预警线与预算引擎保持一致 */
const BUDGET_WARNING = 0.8;
const BUDGET_EXCEEDED = 1;

/**
 * 生成要点列表。顺序即展示顺序：先讲钱，再讲异常。
 * 数据为空的月份返回空数组（页面显示空状态，而不是一堆 0）。
 */
export function buildReportInsights(report: MonthlyReport, locale: Locale): ReportInsight[] {
  if (!report.hasData) return [];

  const insights: ReportInsight[] = [];

  // 1. 支出环比
  const delta = report.deltas.expense;
  if (delta !== null) {
    if (Math.abs(delta) < FLAT_THRESHOLD) {
      insights.push({ key: 'report.insight.expenseFlat' });
    } else if (delta > 0) {
      insights.push({
        key: 'report.insight.expenseUp',
        params: {
          percent: Math.abs(delta),
          amount: formatCurrency(report.expense - report.previous.expense),
        },
      });
    } else {
      insights.push({
        key: 'report.insight.expenseDown',
        params: {
          percent: Math.abs(delta),
          amount: formatCurrency(report.previous.expense - report.expense),
        },
      });
    }
  }

  // 2. 日均
  if (report.expense > 0 && report.elapsedDays > 0) {
    insights.push({
      key: 'report.insight.dailyAverage',
      params: { amount: formatCurrency(report.dailyAverage), days: report.elapsedDays },
    });
  }

  // 3. 花钱最多的分类
  const top = report.topCategories[0];
  if (top) {
    insights.push({
      key: 'report.insight.topCategory',
      params: {
        category: categoryLabel(locale, top.category),
        amount: formatCurrency(top.amount),
        percent: top.percentage,
      },
    });
  }

  // 4. 最大一笔
  if (report.largestExpense) {
    const name = report.largestExpense.counterparty || report.largestExpense.description;
    insights.push({
      key: 'report.insight.largest',
      params: { amount: formatCurrency(report.largestExpense.amount), name },
    });
  }

  // 5. 周期扣款
  if (report.periodics.length > 0) {
    const total = report.periodics.reduce((sum, row) => sum + row.amount, 0);
    insights.push({
      key: 'report.insight.periodic',
      params: { count: report.periodics.length, amount: formatCurrency(total) },
    });
  }

  // 6. 待确认分类（没分类就没法统计，必须提醒）
  if (report.pendingCount > 0) {
    insights.push({
      key: 'report.insight.pending',
      params: { count: report.pendingCount },
    });
  }

  // 7. 预算：只在超支或接近上限时说，正常情况不用占一行
  const budget = report.budget;
  if (budget && budget.percentage >= BUDGET_EXCEEDED) {
    insights.push({
      key: 'report.insight.budgetOver',
      params: { percent: Math.round(budget.percentage * 100) },
    });
  } else if (budget && budget.percentage >= BUDGET_WARNING) {
    insights.push({
      key: 'report.insight.budgetNear',
      params: { percent: Math.round(budget.percentage * 100) },
    });
  }

  return insights;
}
