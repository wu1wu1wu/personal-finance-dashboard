// ============================================================
// 个人记账看板 - 核心类型定义
// ============================================================

/** 交易记录 */
export interface Transaction {
  /** 唯一ID（基于内容哈希生成） */
  id: string;
  /** 交易时间 "2026-07-05 14:30:00" */
  transactionTime: string;
  /** 交易类型：支出/收入/转账 */
  transactionType: '支出' | '收入' | '其他';
  /** 交易对方 */
  counterparty: string;
  /** 商品说明 */
  description: string;
  /** 金额（正数=支出，负数=收入） */
  amount: number;
  /** 支付状态 */
  paymentStatus: string;
  /** 交易单号（去重依据） */
  transactionNo: string;
  /** 支付方式（零钱/银行卡等） */
  paymentMethod: string;
  /** 分类 */
  category: string;
  /** 分类来源：自动/手动 */
  categorySource: 'auto' | 'manual';
  /** 是否周期性交易 */
  isPeriodic: boolean;
  /** 用户自定义标签 */
  tags: string[];
  /** 导入时间 */
  createdAt: string;
  /** 自定义封面图（base64 data URL，空=无封面） */
  coverImage: string;
}

/** 分类规则 */
export interface ClassificationRule {
  /** 规则ID */
  id: string;
  /** 匹配关键词列表 */
  keywords: string[];
  /** 目标分类 */
  category: string;
  /** 优先级（用户自定义 > 内置） */
  priority: number;
  /** 是否用户自定义 */
  isCustom: boolean;
  /** 命中次数（用于权重学习） */
  hitCount: number;
}

/** 预算 */
export interface Budget {
  /** 消费类别 */
  category: string;
  /** 月度预算上限 */
  monthlyLimit: number;
  /** 显示颜色 */
  color: string;
  /** 生效月份 "2026-07"（空字符串=所有月份通用） */
  month: string;
}

/** 预算状态 */
export interface BudgetStatus {
  /** 消费类别 */
  category: string;
  /** 已支出金额 */
  spent: number;
  /** 预算上限 */
  limit: number;
  /** 执行率 0-1+ */
  percentage: number;
  /** 预警级别 */
  level: 'normal' | 'warning' | 'exceeded';
}

/** 周期性交易 */
export interface PeriodicTransaction {
  /** 交易对方 */
  counterparty: string;
  /** 固定金额 */
  amount: number;
  /** 分类 */
  category: string;
  /** 周期 */
  period: 'monthly' | 'quarterly' | 'yearly';
  /** 最近一次交易日期 */
  lastDate: string;
  /** 预计下次日期 */
  nextDate: string;
  /** 识别置信度 0-1 */
  confidence: number;
}

/** 筛选选项 */
export interface FilterOptions {
  /** 月份筛选 "2026-07" */
  month?: string;
  /** 类别筛选 */
  category?: string;
  /** 最小金额 */
  minAmount?: number;
  /** 最大金额 */
  maxAmount?: number;
  /** 搜索关键词 */
  keyword?: string;
}

/** 应用设置 */
export interface AppSettings {
  /** 总月度预算 */
  totalBudget: number;
  /** 是否脱敏 */
  desensitize: boolean;
  /** 默认分类 */
  defaultCategory: string;
}

/** 存储键名常量 */
export const STORAGE_KEYS = {
  TRANSACTIONS: 'pfd_transactions',
  CUSTOM_RULES: 'pfd_custom_rules',
  BUDGETS: 'pfd_budgets',
  TOTAL_BUDGETS: 'pfd_total_budgets',
  SETTINGS: 'pfd_settings',
  CATEGORY_FEEDBACK: 'pfd_cat_feedback',
} as const;

/** 分类定义 */
export const CATEGORIES = [
  { name: '餐饮美食', icon: '🍜', color: '#EF4444' },
  { name: '交通出行', icon: '🚗', color: '#3B82F6' },
  { name: '购物消费', icon: '🛒', color: '#F59E0B' },
  { name: '休闲娱乐', icon: '🎮', color: '#8B5CF6' },
  { name: '居住生活', icon: '🏠', color: '#10B981' },
  { name: '医疗健康', icon: '💊', color: '#EC4899' },
  { name: '教育学习', icon: '📚', color: '#6366F1' },
  { name: '其他', icon: '📌', color: '#6B7280' },
  { name: '待确认', icon: '❓', color: '#9CA3AF' },
] as const;

/** 分类名称类型 */
export type CategoryName = (typeof CATEGORIES)[number]['name'];