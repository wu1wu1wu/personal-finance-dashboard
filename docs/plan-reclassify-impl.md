# 自动分类逻辑重构 实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 用六层判定逻辑（你设的 → 资金搬运/收入 → 商户记忆 → 品类关键词 → 渠道 → 时段金额推测 → 待确认）替换现有的"关键词先命中者赢 + 习惯模型乱猜"引擎，让每条分类都带明确依据。

**Architecture:** 全部判定逻辑做成 `src/core/` 下的纯函数（无 React、无存储），由 `classifyTransactionDetailed` 统一编排；现有的 `classifyTransaction` 保留为返回分类名的薄封装，5 个调用点改为传入上下文。商户记忆与时段金额规则都**从交易数据现算**（不落库、不新增迁移），结果落一条可选字段 `classifyBasis`/`classifyReason` 供界面显示。

**Tech Stack:** TypeScript 6 strict、Vitest 4（node 环境）、Zustand 5、React 19，无新依赖。

**设计文档:** [docs/plan-reclassify.md](plan-reclassify.md)（逻辑定稿，含回放数据）

---

## 文件结构

| 文件 | 职责 | 状态 |
|---|---|---|
| `src/core/merchant-key.ts` | 从交易文本抽商户键（去渠道/单号/分店/脱敏残留），抽不出返回 null | 新建 |
| `src/core/channels.ts` | 渠道词表（电商型/综合型）与识别 | 新建 |
| `src/core/amount-time-rules.ts` | 从已确认记录归纳「时段+金额 → 分类」规则；匹配 | 新建 |
| `src/core/merchant-memory.ts` | 由交易数据构建商户→分类记忆；查询与冲突判定 | 新建 |
| `src/core/classify.ts` | 六层编排：`classifyTransactionDetailed` / `classifyTransaction` | 新建 |
| `src/core/classifier.ts` | 保留关键词匹配与 `classifyTransactions`，改为委托新引擎 | 改造 |
| `src/types/index.ts` | 新增「收入」类别（图标、配色、CategoryName） | 改造 |
| `src/core/transaction-query.ts` | `isConsumption` 排除「收入」 | 改造 |
| `src/stores/transaction-store.ts` | 迁移：金额<0 且非转账/收入 → 收入；分类时写入 basis | 改造 |
| `src/hooks/useAutoLedger.ts` | 捕获时使用新引擎 | 改造 |
| `src/components/transactions/UploadZone.tsx` | 导入时使用新引擎 | 改造 |
| `src/core/transaction-reconcile.ts` | 回填时使用新引擎 | 改造 |
| `src/pages/Transactions.tsx` | 「重新识别」使用新引擎 | 改造 |
| `src/components/transactions/CategoryTag.tsx` | 「推测」标签带依据提示 | 改造 |
| `src/core/replay-classify.test.ts` | 在真实备份上回放（默认跳过，`PFD_BACKUP` 触发），输出等级分布与变化明细 | 新建 |
| `docs/plan-reclassify.md` | 完成后补「实施记录」 | 改造 |

**约定**：`src/core/*.ts` 里的纯函数不得 import React / Zustand / storage；测试文件与被测文件同名同目录（`xxx.test.ts`）。

---

## 批次 1：判定内核（不动界面，行为先用开关隔离）

> 完成后：新逻辑可以跑，但**还没有任何地方调用它**，现有行为不变。这样每一步都能独立验证。

> ⚠️ **执行顺序按编号**：1 → 2 → 3 → **4（关键词模块）** → **5（商户记忆）** → 6 → 7 → 8。
> 文件里 Task 5 的正文排在 Task 4 前面（因为记忆这节写得更早），但**依赖方向是 4 → 5**：
> 商户记忆要 import `keyword-match`，所以必须先做 4。

### Task 1: 商户键抽取

**Files:**
- Create: `src/core/merchant-key.ts`
- Test: `src/core/merchant-key.test.ts`

- [ ] **Step 1: 写失败的测试**

```ts
// src/core/merchant-key.test.ts
import { describe, it, expect } from 'vitest';
import { extractMerchantKey, normalizeMerchantKey } from './merchant-key';

const txn = (counterparty: string, description = '') => ({ counterparty, description });

describe('extractMerchantKey', () => {
  it('从美团账单里抽出真店名', () => {
    expect(extractMerchantKey(txn('美团', '塔斯汀·中国汉堡(武汉宁康路店)-美团App-****218'))).toBe('塔斯汀');
  });

  it('剥掉渠道与单号后保留店名主体', () => {
    expect(extractMerchantKey(txn('美团', '云上优家超市（沌口店）-美团App-****4169'))).toBe('云上优家超市');
  });

  it('支付通知没有商户 → null', () => {
    expect(extractMerchantKey(txn('微信支付', '微信支付: 已支付¥22.30'))).toBeNull();
    expect(extractMerchantKey(txn('微信支付', '微信支付: 已支付¥28.90 [2条]微信支付: 已支付¥28.90'))).toBeNull();
  });

  it('银行短信没有商户 → null', () => {
    expect(
      extractMerchantKey(txn('招商银行', '招商银行: 【招商银行】您账户7301于10月12日入账工资，人民币1800.00。')),
    ).toBeNull();
  });

  it('转账备注不是商户 → null', () => {
    expect(extractMerchantKey(txn('微信转账', '转账备注:微信转账'))).toBeNull();
  });

  it('平台本身不算商户', () => {
    expect(extractMerchantKey(txn('淘宝平台商户', '商户单号XP****4169'))).toBeNull();
    expect(extractMerchantKey(txn('美团', ''))).toBeNull();
  });

  it('描述为空时退回交易对方', () => {
    expect(extractMerchantKey(txn('霸王茶姬'))).toBe('霸王茶姬');
    expect(extractMerchantKey(txn('湖工大-沌阳大道'))).toBe('湖工大-沌阳大道');
  });

  it('脱敏残留的四位数字要清掉', () => {
    expect(extractMerchantKey(txn('美团', '七婆婆酱排骨蹄花焖锅- - 4180'))).toBe('七婆婆酱排骨蹄花焖锅');
  });
});

describe('normalizeMerchantKey', () => {
  it('分店括号去掉，连锁后缀按 · 截断', () => {
    expect(normalizeMerchantKey('塔斯汀·中国汉堡(武汉宁康路店)')).toBe('塔斯汀');
    expect(normalizeMerchantKey('尚酥坊·手工點心（沌口店）')).toBe('尚酥坊');
  });

  it('太短的键丢弃', () => {
    expect(normalizeMerchantKey('店')).toBeNull();
    expect(normalizeMerchantKey('')).toBeNull();
  });
});
```

- [ ] **Step 2: 跑测试确认失败**

Run: `node node_modules/vitest/vitest.mjs run src/core/merchant-key.test.ts`
Expected: FAIL — `Failed to resolve import "./merchant-key"`

- [ ] **Step 3: 实现**

```ts
// src/core/merchant-key.ts
// ============================================================
// 商户键抽取
//
// 微信账单的「商品说明」里通常写着真店名（塔斯汀·中国汉堡(武汉宁康路店)-美团App-***），
// 而「交易对方」只是渠道名（美团）。分类应该认店名，不是认渠道。
// 支付通知（微信支付: 已支付¥22.30）里没有任何商户信息，此时必须返回 null，
// 绝不能把通知原文当成商户名——那会让"商户记忆"学进一堆垃圾键。
// ============================================================

import type { Transaction } from '@/types';

/** 商户键最长长度：超过它基本是整段通知原文，不是店名 */
export const MAX_MERCHANT_KEY_LENGTH = 24;

/** 商户键最短长度 */
const MIN_MERCHANT_KEY_LENGTH = 2;

/** 出现这些字样说明是通知/短信原文，不是商户 */
const NOTIFY_PATTERN =
  /已支付|入账工资|已到账|您账户|已隐藏敏感通知内容|理赔|转账备注|收款方备注/;

/** 平台名：单独出现时不能当商户（美团、淘宝… 是渠道，不是店） */
const CHANNEL_PATTERN = /^(微信支付|支付宝|美团|饿了么|淘宝|京东|拼多多|天猫|抖音|高德|唯品会|苏宁)$/;

/** 依次剥离的噪声 */
function stripNoise(input: string): string {
  return input
    .replace(/^(微信支付|支付宝)[:：]\s*/, '')
    .replace(/\[?\d+条\]?/g, ' ')
    .replace(/商户单号[^\s]*|订单号[^\s]*|订单[-\s]*编号[^\s]*/g, ' ')
    .replace(/美团App|饿了么App|美团平台商户|淘宝平台商户|美团收银|美团订单/g, ' ')
    .replace(/为[\d\s]{6,}充值[^\s]*/g, ' ')
    .replace(/[¥￥]\s*[\d.]+/g, ' ')
    .replace(/\*{2,}/g, ' ')
    // 脱敏后的单号只剩后 4 位，会以独立数字的形式残留
    .replace(/(?<![0-9])\d{4}(?![0-9])/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * 归一化商户键：去分店括号、按 `·` 截断连锁后缀。
 * 返回 null 表示这个键不可用。
 */
export function normalizeMerchantKey(raw: string): string | null {
  const key = raw
    .replace(/（[^）]*店）|\([^)]*店\)/g, ' ')
    .replace(/[·•・].*$/, '')
    .replace(/[-－\s]+$/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  if (key.length < MIN_MERCHANT_KEY_LENGTH || key.length > MAX_MERCHANT_KEY_LENGTH) return null;
  if (CHANNEL_PATTERN.test(key)) return null;
  return key;
}

/**
 * 抽取商户键。抽不出返回 null。
 * 优先用「商品说明」（带真店名），说明没货时退回「交易对方」。
 */
export function extractMerchantKey(
  txn: Pick<Transaction, 'counterparty' | 'description'>,
): string | null {
  const description = stripNoise(txn.description ?? '');
  const usable = description !== '' && !NOTIFY_PATTERN.test(description);

  if (usable) {
    const fromDescription = normalizeMerchantKey(description);
    if (fromDescription) return fromDescription;
  }

  const counterparty = (txn.counterparty ?? '').trim();
  if (!counterparty || NOTIFY_PATTERN.test(counterparty)) return null;
  return normalizeMerchantKey(counterparty);
}
```

- [ ] **Step 4: 跑测试确认通过**

Run: `node node_modules/vitest/vitest.mjs run src/core/merchant-key.test.ts`
Expected: PASS，`Tests  13 passed`

- [ ] **Step 5: 提交**

```bash
git add src/core/merchant-key.ts src/core/merchant-key.test.ts
git commit -m "feat(classify): 商户键抽取（去渠道/单号/脱敏残留，抽不出返回 null）"
```

---

### Task 2: 渠道识别

**Files:**
- Create: `src/core/channels.ts`
- Test: `src/core/channels.test.ts`

- [ ] **Step 1: 写失败的测试**

```ts
// src/core/channels.test.ts
import { describe, it, expect } from 'vitest';
import { detectChannel, isChannelWord, ECOMMERCE_CHANNELS, PLATFORM_CHANNELS } from './channels';

describe('detectChannel', () => {
  it('电商平台识别为 ecommerce', () => {
    expect(detectChannel('淘宝平台商户 商户单号XP****4169')).toEqual({ name: '淘宝', kind: 'ecommerce' });
    expect(detectChannel('拼多多')?.kind).toBe('ecommerce');
  });

  it('综合平台识别为 platform', () => {
    expect(detectChannel('美团 塔斯汀·中国汉堡(武汉宁康路店)-美团App-***')).toEqual({
      name: '美团',
      kind: 'platform',
    });
    expect(detectChannel('抖音生活服务商家')?.kind).toBe('platform');
  });

  it('没有渠道返回 null', () => {
    expect(detectChannel('星巴克咖啡')).toBeNull();
    expect(detectChannel('')).toBeNull();
  });

  it('长词优先（美团单车里识别出美团）', () => {
    expect(detectChannel('美团单车')?.name).toBe('美团');
  });
});

describe('isChannelWord', () => {
  it('渠道词不参与品类关键词匹配', () => {
    expect(isChannelWord('美团')).toBe(true);
    expect(isChannelWord('淘宝')).toBe(true);
    expect(isChannelWord('星巴克')).toBe(false);
  });

  it('两张表的并集', () => {
    for (const c of [...ECOMMERCE_CHANNELS, ...PLATFORM_CHANNELS]) expect(isChannelWord(c)).toBe(true);
  });
});
```

- [ ] **Step 2: 跑测试确认失败**

Run: `node node_modules/vitest/vitest.mjs run src/core/channels.test.ts`
Expected: FAIL — 模块不存在

- [ ] **Step 3: 实现**

```ts
// src/core/channels.ts
// ============================================================
// 渠道词表
//
// 电商型：在这些平台下单本身就是"购物"，是平台性质，不是猜。
// 综合型：同一平台什么都能买（美团：外卖/单车/买药/超市），只能作为"推测"依据，
//         且必须结合该渠道的历史分类与店名。
//
// 渠道词**不参与品类关键词匹配**——这是"美团单车被判餐饮"的根因。
// ============================================================

export const ECOMMERCE_CHANNELS = ['淘宝', '拼多多', '天猫', '京东', '唯品会'] as const;
export const PLATFORM_CHANNELS = ['美团', '饿了么', '抖音', '高德'] as const;

export type ChannelKind = 'ecommerce' | 'platform';

export interface DetectedChannel {
  name: string;
  kind: ChannelKind;
}

/** 所有渠道词，按长度降序，保证长词优先匹配 */
const ALL_CHANNELS: { name: string; kind: ChannelKind }[] = [
  ...ECOMMERCE_CHANNELS.map((name) => ({ name, kind: 'ecommerce' as const })),
  ...PLATFORM_CHANNELS.map((name) => ({ name, kind: 'platform' as const })),
].sort((a, b) => b.name.length - a.name.length);

export function isChannelWord(word: string): boolean {
  return ALL_CHANNELS.some((c) => c.name === word);
}

/** 从一段文本里识别渠道，识别不到返回 null */
export function detectChannel(text: string): DetectedChannel | null {
  if (!text) return null;
  const hit = ALL_CHANNELS.find((c) => text.includes(c.name));
  return hit ?? null;
}
```

- [ ] **Step 4: 跑测试确认通过**

Run: `node node_modules/vitest/vitest.mjs run src/core/channels.test.ts`
Expected: PASS

- [ ] **Step 5: 提交**

```bash
git add src/core/channels.ts src/core/channels.test.ts
git commit -m "feat(classify): 渠道词分电商型与综合型，渠道词不参与品类匹配"
```

---

### Task 3: 时段 + 金额规则（归纳与匹配）

**Files:**
- Create: `src/core/amount-time-rules.ts`
- Test: `src/core/amount-time-rules.test.ts`

- [ ] **Step 1: 写失败的测试**

```ts
// src/core/amount-time-rules.test.ts
import { describe, it, expect } from 'vitest';
import type { Transaction } from '@/types';
import {
  induceAmountTimeRules,
  matchAmountTimeRule,
  RULE_MIN_SUPPORT,
  RULE_MIN_PURITY,
} from './amount-time-rules';

function txn(amount: number, time: string, category: string): Transaction {
  return {
    id: `${amount}-${time}-${category}`,
    transactionTime: time,
    transactionType: '支出',
    counterparty: '',
    description: '',
    amount,
    paymentStatus: '',
    transactionNo: '',
    paymentMethod: '',
    category,
    categorySource: 'manual',
    origin: 'manual',
    isPeriodic: false,
    tags: [],
    createdAt: time,
    coverImage: '',
    theme: '',
  };
}

describe('induceAmountTimeRules', () => {
  it('20 元档、午晚时段的餐饮占压倒多数时归纳成规则', () => {
    // 六条全部落在 20~25 元这个档里，纯度 100%，满足 支持≥5
    const confirmed = [
      txn(22.9, '2026-09-01 11:30:00', '餐饮美食'),
      txn(23.88, '2026-09-02 11:40:00', '餐饮美食'),
      txn(24.3, '2026-09-03 12:19:00', '餐饮美食'),
      txn(21.28, '2026-09-04 16:47:00', '餐饮美食'),
      txn(22.5, '2026-09-05 15:22:00', '餐饮美食'),
      txn(23.1, '2026-09-06 20:36:00', '餐饮美食'),
    ];
    const rules = induceAmountTimeRules(confirmed);
    expect(rules.length).toBeGreaterThan(0);
    const dining = rules.find((r) => r.category === '餐饮美食');
    expect(dining).toBeDefined();
    expect(dining!.minAmount).toBe(20);
    expect(dining!.maxAmount).toBe(25);
    expect(dining!.hitRate).toBeGreaterThanOrEqual(RULE_MIN_PURITY);
  });

  it('样本不足不产出规则', () => {
    const few = [
      txn(22, '2026-09-01 12:00:00', '餐饮美食'),
      txn(23, '2026-09-02 12:00:00', '餐饮美食'),
    ];
    expect(induceAmountTimeRules(few)).toEqual([]);
  });

  it('纯度不够不产出规则（金额档里混了别的分类）', () => {
    const mixed = [
      txn(22, '2026-09-01 12:00:00', '餐饮美食'),
      txn(23, '2026-09-02 12:00:00', '餐饮美食'),
      txn(24, '2026-09-03 12:00:00', '餐饮美食'),
      txn(21, '2026-09-04 12:00:00', '购物消费'),
      txn(20, '2026-09-05 12:00:00', '交通出行'),
      txn(25, '2026-09-06 12:00:00', '休闲娱乐'),
    ];
    expect(induceAmountTimeRules(mixed)).toEqual([]);
  });

  it('收入（负数）不参与规则归纳', () => {
    const withIncome = [
      txn(-1800, '2026-09-01 12:00:00', '收入'),
      ...Array.from({ length: 5 }, (_, i) => txn(20 + i, `2026-09-0${i + 1} 12:00:00`, '餐饮美食')),
    ];
    const rules = induceAmountTimeRules(withIncome);
    expect(rules.every((r) => r.category !== '收入')).toBe(true);
  });
});

describe('matchAmountTimeRule', () => {
  const rules = [
    { category: '餐饮美食', startMinute: 600, endMinute: 1260, minAmount: 15, maxAmount: 25, support: 12, hitRate: 0.83 },
  ];

  it('落在区间内命中', () => {
    expect(matchAmountTimeRule({ amount: 22.3, transactionTime: '2026-10-01 12:00:00' }, rules)?.category).toBe(
      '餐饮美食',
    );
  });

  it('金额超出区间不命中', () => {
    expect(matchAmountTimeRule({ amount: 46.93, transactionTime: '2026-10-01 12:00:00' }, rules)).toBeNull();
  });

  it('时段外不命中', () => {
    expect(matchAmountTimeRule({ amount: 22, transactionTime: '2026-10-01 05:00:00' }, rules)).toBeNull();
  });

  it('收入不套用支出规则', () => {
    expect(matchAmountTimeRule({ amount: -22, transactionTime: '2026-10-01 12:00:00' }, rules)).toBeNull();
  });
});
```

- [ ] **Step 2: 跑测试确认失败**

Run: `node node_modules/vitest/vitest.mjs run src/core/amount-time-rules.test.ts`
Expected: FAIL — 模块不存在

- [ ] **Step 3: 实现**

```ts
// src/core/amount-time-rules.ts
// ============================================================
// 「时段 + 金额 → 分类」规则
//
// 背景：微信支付通知只有金额和时间，没有商户。实测（176 条真实数据）：
//   15~25 元 且 10:00–21:00 → 餐饮，支持 12 条、纯度 83%
// 金额是最强信号，时段主要用来排除清晨。83% ≠ 确定，所以只作为「推测」。
//
// 规则只从「用户确认过的分类」归纳，绝不从推测结果里学，否则会自我强化。
// ============================================================

import type { Transaction } from '@/types';

/** 归纳一条规则至少需要多少条样本 */
export const RULE_MIN_SUPPORT = 5;
/** 规则纯度（最高频分类占比）下限 */
export const RULE_MIN_PURITY = 0.8;
/** 最多保留几条规则（按支持数降序） */
export const RULE_MAX_COUNT = 8;

/** 金额档步长（元） */
const AMOUNT_STEP = 5;
/** 金额档上限（元） */
const AMOUNT_MAX = 120;

/** 候选时段窗口（分钟） */
const TIME_WINDOWS: { startMinute: number; endMinute: number }[] = [
  { startMinute: 0, endMinute: 24 * 60 - 1 },
  { startMinute: 6 * 60, endMinute: 10 * 60 },
  { startMinute: 10 * 60, endMinute: 14 * 60 },
  { startMinute: 14 * 60, endMinute: 18 * 60 },
  { startMinute: 18 * 60, endMinute: 22 * 60 },
  { startMinute: 10 * 60, endMinute: 21 * 60 },
];

export interface AmountTimeRule {
  category: string;
  /** 起始分钟数（0 表示不限） */
  startMinute: number;
  /** 结束分钟数 */
  endMinute: number;
  minAmount: number;
  maxAmount: number;
  /** 支持条数 */
  support: number;
  /** 纯度 0-1 */
  hitRate: number;
}

/** 从 "yyyy-MM-dd HH:mm:ss" 取当天分钟数；解析失败返回 null */
function minuteOfDay(dateTime: string): number | null {
  const m = dateTime?.match(/^\d{4}-\d{2}-\d{2}[ T](\d{2}):(\d{2})/);
  if (!m) return null;
  return Number(m[1]) * 60 + Number(m[2]);
}

interface RuleCandidate extends AmountTimeRule {
  /** 命中的分类计数 */
  counts: Map<string, number>;
}

/**
 * 从已确认（用户手设）的记录归纳规则。
 * 只使用 amount > 0 的支出记录；推测出来的分类不得参与（调用方负责只传 manual）。
 */
export function induceAmountTimeRules(confirmed: Transaction[]): AmountTimeRule[] {
  const samples = confirmed
    .filter((t) => t.categorySource === 'manual' && t.amount > 0 && t.category)
    .map((t) => ({ amount: t.amount, minute: minuteOfDay(t.transactionTime), category: t.category }))
    .filter((s): s is { amount: number; minute: number; category: string } => s.minute !== null);

  const candidates: AmountTimeRule[] = [];

  for (const window of TIME_WINDOWS) {
    for (let min = 0; min < AMOUNT_MAX; min += AMOUNT_STEP) {
      const max = min + AMOUNT_STEP;
      const inBucket = samples.filter(
        (s) => s.amount >= min && s.amount <= max && s.minute >= window.startMinute && s.minute <= window.endMinute,
      );
      if (inBucket.length < RULE_MIN_SUPPORT) continue;

      const counts = new Map<string, number>();
      for (const s of inBucket) counts.set(s.category, (counts.get(s.category) ?? 0) + 1);
      const top = [...counts.entries()].sort((a, b) => b[1] - a[1])[0];
      const hitRate = top[1] / inBucket.length;
      if (hitRate < RULE_MIN_PURITY) continue;

      candidates.push({
        category: top[0],
        startMinute: window.startMinute,
        endMinute: window.endMinute,
        minAmount: min,
        maxAmount: max,
        support: inBucket.length,
        hitRate,
      });
    }
  }

  // 同一分类只保留支持数最高的一条，避免规则互相打架
  const best = new Map<string, AmountTimeRule>();
  for (const c of candidates) {
    const current = best.get(c.category);
    if (!current || c.support > current.support || (c.support === current.support && c.hitRate > current.hitRate)) {
      best.set(c.category, c);
    }
  }

  return [...best.values()].sort((a, b) => b.support - a.support).slice(0, RULE_MAX_COUNT);
}

/** 匹配规则；不命中返回 null。收入（负数）不套用支出规则。 */
export function matchAmountTimeRule(
  txn: Pick<Transaction, 'amount' | 'transactionTime'>,
  rules: AmountTimeRule[],
): AmountTimeRule | null {
  if (txn.amount <= 0) return null;
  const minute = minuteOfDay(txn.transactionTime);
  if (minute === null) return null;
  const amount = Math.abs(txn.amount);
  return (
    rules.find(
      (r) => amount >= r.minAmount && amount <= r.maxAmount && minute >= r.startMinute && minute <= r.endMinute,
    ) ?? null
  );
}
```

- [ ] **Step 4: 跑测试确认通过**

Run: `node node_modules/vitest/vitest.mjs run src/core/amount-time-rules.test.ts`
Expected: PASS

- [ ] **Step 5: 用真实数据核对归纳结果**

Run:
```bash
node -e "
const {readFileSync}=require('fs');
const j=JSON.parse(readFileSync('C:/Users/86180/xwechat_files/wxid_m03p7sn7u42922_dc9f/msg/file/2026-10/记账备份_已脱敏_2026-10-18.json','utf8'));
const t=j.pfd_transactions.filter(x=>x.categorySource==='manual'&&x.amount>0);
console.log('手设支出记录:',t.length);
"
```
Expected: 输出条数，且与设计文档 §2.1 的样本规模一致（约 20 条）。若本机没有该备份文件，跳过此步并在 PR 说明里注明。

- [ ] **Step 6: 提交**

```bash
git add src/core/amount-time-rules.ts src/core/amount-time-rules.test.ts
git commit -m "feat(classify): 时段+金额规则归纳与匹配（支持≥5、纯度≥80%）"
```

---

### Task 5: 商户记忆（依赖 Task 4 的 keyword-match）

**Files:**
- Create: `src/core/merchant-memory.ts`
- Test: `src/core/merchant-memory.test.ts`

- [ ] **Step 1: 写失败的测试**

```ts
// src/core/merchant-memory.test.ts
import { describe, it, expect } from 'vitest';
import type { Transaction } from '@/types';
import { buildMerchantMemory, lookupMerchantMemory } from './merchant-memory';
import { extractMerchantKey } from './merchant-key';

function txn(partial: Partial<Transaction>): Transaction {
  return {
    id: partial.id ?? 'x',
    transactionTime: '2026-09-01 12:00:00',
    transactionType: '支出',
    counterparty: '',
    description: '',
    amount: 20,
    paymentStatus: '',
    transactionNo: '',
    paymentMethod: '',
    category: '待确认',
    categorySource: 'auto',
    origin: 'import',
    isPeriodic: false,
    tags: [],
    createdAt: '2026-09-01 12:00:00',
    coverImage: '',
    theme: '',
    ...partial,
  };
}

describe('buildMerchantMemory', () => {
  it('从用户手设的记录学', () => {
    const memory = buildMerchantMemory([txn({ counterparty: '塔斯汀', category: '餐饮美食', categorySource: 'manual' })]);
    expect(lookupMerchantMemory(memory, '塔斯汀')).toEqual({ category: '餐饮美食' });
  });

  it('从关键词命中的记录学（店名可识别时）', () => {
    const memory = buildMerchantMemory([
      txn({ counterparty: '肯德基宅急送', category: '餐饮美食', categorySource: 'auto' }),
    ]);
    expect(lookupMerchantMemory(memory, '肯德基宅急送')).toEqual({ category: '餐饮美食' });
  });

  it('推测出来的分类不进记忆', () => {
    const memory = buildMerchantMemory([
      txn({ counterparty: '某店', category: '餐饮美食', categorySource: 'guessed' }),
    ]);
    expect(lookupMerchantMemory(memory, '某店')).toBeNull();
  });

  it('同一商户两种分类 → 冲突，不投票', () => {
    const memory = buildMerchantMemory([
      txn({ id: 'a', counterparty: '某店', category: '餐饮美食', categorySource: 'manual' }),
      txn({ id: 'b', counterparty: '某店', category: '购物消费', categorySource: 'manual' }),
    ]);
    expect(lookupMerchantMemory(memory, '某店')).toEqual({ conflict: true });
  });

  it('商户键为 null 的记录不参与', () => {
    const memory = buildMerchantMemory([
      txn({ counterparty: '微信支付', description: '微信支付: 已支付¥22.30', category: '餐饮美食', categorySource: 'manual' }),
    ]);
    expect(memory.size).toBe(0);
  });
});

describe('extractMerchantKey 与记忆的配合', () => {
  it('带店名的记录能建立记忆键', () => {
    const t = txn({
      counterparty: '美团',
      description: '塔斯汀·中国汉堡(武汉宁康路店)-美团App-****218',
      categorySource: 'manual',
      category: '餐饮美食',
    });
    expect(extractMerchantKey(t)).toBe('塔斯汀');
    const memory = buildMerchantMemory([t]);
    expect(lookupMerchantMemory(memory, '塔斯汀')).toEqual({ category: '餐饮美食' });
  });
});
```

- [ ] **Step 2: 跑测试确认失败**

Run: `node node_modules/vitest/vitest.mjs run src/core/merchant-memory.test.ts`
Expected: FAIL — 模块不存在

- [ ] **Step 3: 实现**

```ts
// src/core/merchant-memory.ts
// ============================================================
// 商户记忆：商户键 → 分类
//
// 只从「可信来源」学：
//   1. 用户手设的分类（categorySource === 'manual'）
//   2. 关键词命中的分类（categorySource === 'auto' 且能匹配到品类词）
// 推测（guessed）、待确认、渠道推断一律不学——猜的东西不能固化成记忆。
//
// 同一商户键有两种分类 → 视为冲突，查询返回 { conflict: true }，调用方判「待确认」。
// 记忆不落库：每次由交易数据现算，永远与最新数据一致。
// ============================================================

import type { Transaction } from '@/types';
import { extractMerchantKey } from './merchant-key';
import { classifyByKeyword } from './keyword-match';

export interface MerchantMemoryEntry {
  category: string;
}

export type MerchantMemory = ReadonlyMap<string, { category: string; conflict: boolean }>;

/** 从交易数据构建记忆。excludeId 用于留一法验证。 */
export function buildMerchantMemory(
  transactions: Transaction[],
  options: { excludeId?: string } = {},
): MerchantMemory {
  const counts = new Map<string, Map<string, number>>();

  for (const txn of transactions) {
    if (options.excludeId && txn.id === options.excludeId) continue;
    const key = extractMerchantKey(txn);
    if (!key) continue;

    let category: string | null = null;
    if (txn.categorySource === 'manual') {
      category = txn.category;
    } else if (txn.categorySource === 'auto') {
      const hit = classifyByKeyword(txn);
      category = hit?.category ?? null;
    }
    if (!category || category === '待确认') continue;

    const bucket = counts.get(key) ?? new Map<string, number>();
    bucket.set(category, (bucket.get(category) ?? 0) + 1);
    counts.set(key, bucket);
  }

  const memory = new Map<string, { category: string; conflict: boolean }>();
  for (const [key, bucket] of counts) {
    const sorted = [...bucket.entries()].sort((a, b) => b[1] - a[1]);
    if (sorted.length > 1) {
      // 同一商户出现过两种分类：标记冲突，查询时判「待确认」，不做多数投票
      memory.set(key, { category: sorted[0][0], conflict: true });
    } else {
      memory.set(key, { category: sorted[0][0], conflict: false });
    }
  }
  return memory;
}

/** 查询记忆：命中返回分类；冲突返回 conflict；没有返回 null */
export function lookupMerchantMemory(
  memory: MerchantMemory,
  key: string | null,
): { category: string } | { conflict: true } | null {
  if (!key) return null;
  const entry = memory.get(key);
  if (!entry) return null;
  if (entry.conflict) return { conflict: true };
  return { category: entry.category };
}
```

- [ ] **Step 4: 跑测试确认通过**

Run: `node node_modules/vitest/vitest.mjs run src/core/merchant-memory.test.ts`
Expected: PASS

- [ ] **Step 5: 提交**

```bash
git add src/core/merchant-memory.ts src/core/merchant-memory.test.ts
git commit -m "feat(classify): 商户记忆（只学手设与关键词，冲突不投票）"
```

---

### Task 4: 关键词匹配独立成模块（先做）

**Files:**
- Create: `src/core/keyword-match.ts`
- Test: `src/core/keyword-match.test.ts`
- Modify: `src/core/classifier.ts`（改成调用新模块，保持对外签名不变）

- [ ] **Step 1: 写失败的测试**

```ts
// src/core/keyword-match.test.ts
import { describe, it, expect } from 'vitest';
import { classifyByKeyword } from './keyword-match';
import { BUILTIN_RULES } from '@/constants/rules';

describe('classifyByKeyword', () => {
  it('最长词优先：超市压过渠道词美团', () => {
    const hit = classifyByKeyword(
      { transactionType: '支出', counterparty: '美团', description: '云上优家超市（沌口店）-美团App-***' },
      { customRules: [] },
    );
    expect(hit?.category).toBe('购物消费');
    expect(hit?.keyword).toBe('超市');
  });

  it('渠道词本身不参与匹配', () => {
    const hit = classifyByKeyword(
      { transactionType: '支出', counterparty: '美团', description: '塔斯汀·中国汉堡' },
      { customRules: [] },
    );
    expect(hit?.keyword).not.toBe('美团');
    expect(hit?.keyword).toBe('塔斯汀');
  });

  it('自定义规则优先', () => {
    const hit = classifyByKeyword(
      { transactionType: '支出', counterparty: '星巴克', description: '' },
      { customRules: [{ id: 'c', keywords: ['星巴克'], category: '休闲娱乐', priority: 100, isCustom: true, hitCount: 0 }] },
    );
    expect(hit?.category).toBe('休闲娱乐');
  });

  it('都没有命中返回 null', () => {
    expect(classifyByKeyword({ transactionType: '支出', counterparty: '某未知商户', description: '' }, { customRules: [] })).toBeNull();
  });

  it('内置词表里确实没有渠道词', () => {
    const words = BUILTIN_RULES.flatMap((r) => r.keywords);
    expect(words).not.toContain('美团');
  });
});
```

> 最后一条测试依赖 Task 6 的规则表改造；如果你按顺序执行，它会先失败——这是预期的**红**，Task 6 完成后转绿。若希望本任务全绿，可先注释该用例并在 Task 6 恢复。- [ ] **Step 2: 跑测试确认失败**

Run: `node node_modules/vitest/vitest.mjs run src/core/keyword-match.test.ts`
Expected: FAIL — 模块不存在

- [ ] **Step 3: 实现**

```ts
// src/core/keyword-match.ts
// ============================================================
// 品类关键词匹配
//
// 与旧 classifier 的差别：
//   1. 渠道词不参与匹配（美团/淘宝… 交给 L5 渠道层）
//   2. 最长词优先，其次优先级，其次命中数量（旧版是"谁先写谁赢"）
//   3. 支持反例词（excludes）：命中反例则该关键词作废
// ============================================================

import type { ClassificationRule, Transaction } from '@/types';
import { BUILTIN_RULES } from '@/constants/rules';
import { isChannelWord } from './channels';

/** 关键词 → 分类的中转结构，规则表与自定义规则统一成这个形状 */
interface KeywordEntry {
  keyword: string;
  category: string;
  priority: number;
  excludes: string[];
}

function toEntries(rules: ClassificationRule[]): KeywordEntry[] {
  const entries: KeywordEntry[] = [];
  for (const rule of rules) {
    for (const keyword of rule.keywords) {
      if (isChannelWord(keyword)) continue; // 渠道词不是品类词
      entries.push({
        keyword,
        category: rule.category,
        priority: rule.priority,
        excludes: rule.excludes ?? [],
      });
    }
  }
  return entries;
}

const BUILTIN_ENTRIES = toEntries(BUILTIN_RULES);

export interface KeywordHit {
  category: string;
  keyword: string;
}

/**
 * 按品类关键词判定。
 * @returns 命中则返回分类与命中词；否则 null
 */
export function classifyByKeyword(
  txn: Pick<Transaction, 'transactionType' | 'counterparty' | 'description'>,
  options: { customRules?: ClassificationRule[] } = {},
): KeywordHit | null {
  const text = `${txn.transactionType ?? ''} ${txn.counterparty ?? ''} ${txn.description ?? ''}`.toLowerCase();
  if (!text.trim()) return null;

  const custom = options.customRules?.length ? toEntries(options.customRules) : [];
  const candidates = [...custom, ...BUILTIN_ENTRIES].filter((entry) => {
    if (!text.includes(entry.keyword.toLowerCase())) return false;
    // 反例词：出现了就作废这条关键词
    return !entry.excludes.some((ex) => text.includes(ex.toLowerCase()));
  });

  if (candidates.length === 0) return null;

  candidates.sort(
    (a, b) =>
      b.keyword.length - a.keyword.length ||
      b.priority - a.priority ||
      a.keyword.localeCompare(b.keyword),
  );
  return { category: candidates[0].category, keyword: candidates[0].keyword };
}
```

- [ ] **Step 4: 给 `ClassificationRule` 加上 `excludes`**

```ts
// src/types/index.ts —— 在 ClassificationRule 里新增字段
export interface ClassificationRule {
  id: string;
  keywords: string[];
  category: string;
  priority: number;
  isCustom: boolean;
  hitCount: number;
  /** 反例词：文本里出现其中任一，本规则作废（可选） */
  excludes?: string[];
}
```

- [ ] **Step 5: 跑测试确认通过（最后一条除外）**

Run: `node node_modules/vitest/vitest.mjs run src/core/keyword-match.test.ts`
Expected: PASS（若保留"内置词表无渠道词"用例，此步会红，属预期）

- [ ] **Step 6: 提交**

```bash
git add src/core/keyword-match.ts src/core/keyword-match.test.ts src/types/index.ts
git commit -m "feat(classify): 关键词匹配改为最长词优先，渠道词不参与，支持反例词"
```

---

### Task 6: 规则表改造（渠道词移出关键词表）

**Files:**
- Modify: `src/constants/rules.ts`
- Test: `src/core/keyword-match.test.ts`（Task 4 的最后一条用例转绿）

- [ ] **Step 1: 改写三条受影响的规则**

把 `src/constants/rules.ts` 里的 `rule-dining-1`、`rule-transport-1`、`rule-shopping-1` 改成下面这样（渠道词已删除，新增业务词已补上）：

```ts
{
  id: 'rule-dining-1',
  // 删掉「美团」「饿了么」：它是渠道，不是品类，渠道由 channels.ts 单独处理
  keywords: ['肯德基', '麦当劳', '星巴克', '瑞幸', '奶茶', '火锅', '烧烤', '烤肉', '自助餐', '外卖', '餐厅',
             '饭馆', '食堂', '小吃', '快餐', '咖啡', '饮品', '甜品', '面包', '蛋糕', '池奈', '詹记', '仟吉',
             '塔斯汀', '古茗', '饭团', '果园', '副食', '首义学院', '零食', '姜胖胖'],
  category: '餐饮美食',
  priority: 10,
  isCustom: false,
  hitCount: 0,
},
{
  id: 'rule-transport-1',
  // 删掉「高德」（渠道）；补「单车」「代驾」「骑行」——美团单车这类要能认出是交通
  keywords: ['滴滴', '地铁', '公交', '出租车', '加油', '停车', '高速', '铁路', '12306', '航空', '携程',
             '去哪儿', '飞猪', '打车', '共享单车', '单车', '骑行', '代驾', '哈啰', '青桔', '驴充充', '充电',
             '铁旅科技'],
  category: '交通出行',
  priority: 10,
  isCustom: false,
  hitCount: 0,
},
{
  id: 'rule-shopping-1',
  // 删掉「淘宝」「京东」「拼多多」「天猫」「苏宁」「唯品会」「抖音」：全是渠道
  keywords: ['超市', '便利店', '商场', '网购', '快递', '顺丰', '中通', '圆通', '韵达', '小黑盒', '特产',
             '闪购', '优选', '买菜'],
  category: '购物消费',
  priority: 10,
  isCustom: false,
  hitCount: 0,
},
```

再给医疗健康（`rule-health-1`）补 `买药`、`问诊`，给休闲娱乐（`rule-entertainment-1`）补 `酒店`、`民宿`、`到店`。

- [ ] **Step 2: 跑测试**

Run: `node node_modules/vitest/vitest.mjs run src/core/keyword-match.test.ts src/core/classifier.test.ts`
Expected: `keyword-match` 全绿；`classifier.test.ts` **会红**——它断言"美团 → 餐饮美食"。这是预期的红，Task 9 会改写这些用例。

- [ ] **Step 3: 提交**

```bash
git add src/constants/rules.ts
git commit -m "feat(classify): 渠道词移出关键词表，补单车/买药/闪购等业务词"
```

---

### Task 7: 六层编排引擎

**Files:**
- Create: `src/core/classify.ts`
- Test: `src/core/classify.test.ts`

- [ ] **Step 1: 写失败的测试**

```ts
// src/core/classify.test.ts
import { describe, it, expect } from 'vitest';
import type { Transaction } from '@/types';
import { classifyTransactionDetailed } from './classify';
import { buildMerchantMemory } from './merchant-memory';

function txn(partial: Partial<Transaction> = {}): Transaction {
  return {
    id: partial.id ?? 'x',
    transactionTime: '2026-09-01 12:00:00',
    transactionType: '支出',
    counterparty: '',
    description: '',
    amount: 22,
    paymentStatus: '',
    transactionNo: '',
    paymentMethod: '',
    category: '待确认',
    categorySource: 'auto',
    origin: 'import',
    isPeriodic: false,
    tags: [],
    createdAt: '2026-09-01 12:00:00',
    coverImage: '',
    theme: '',
    ...partial,
  };
}

const amountTimeRules = [
  { category: '餐饮美食', startMinute: 600, endMinute: 1260, minAmount: 15, maxAmount: 25, support: 12, hitRate: 0.83 },
];

describe('L1 你设的', () => {
  it('手设分类原样返回，等级 certain', () => {
    const r = classifyTransactionDetailed(
      txn({ counterparty: '美团', category: '交通出行', categorySource: 'manual' }),
      { amountTimeRules },
    );
    expect(r).toMatchObject({ category: '交通出行', basis: 'user', level: 'certain' });
  });
});

describe('L2 资金搬运与收入', () => {
  it('转账类词 → 转账', () => {
    const r = classifyTransactionDetailed(txn({ description: '转账备注:微信转账', amount: 200 }), { amountTimeRules });
    expect(r).toMatchObject({ category: '转账', basis: 'transfer', level: 'certain' });
  });

  it('金额为负且非转账 → 收入', () => {
    const r = classifyTransactionDetailed(txn({ amount: -1800, counterparty: '招商银行', description: '入账工资' }), {
      amountTimeRules,
    });
    expect(r).toMatchObject({ category: '收入', basis: 'income', level: 'certain' });
  });

  it('退款优先于收入', () => {
    const r = classifyTransactionDetailed(txn({ amount: -50, description: '退款' }), { amountTimeRules });
    expect(r.category).toBe('转账');
  });
});

describe('L3 商户记忆', () => {
  const memory = buildMerchantMemory([
    txn({ id: 'a', counterparty: '塔斯汀', category: '餐饮美食', categorySource: 'manual' }),
  ]);

  it('记忆命中 → certain', () => {
    const r = classifyTransactionDetailed(txn({ counterparty: '塔斯汀' }), { memory, amountTimeRules });
    expect(r).toMatchObject({ category: '餐饮美食', basis: 'memory', level: 'certain' });
  });

  it('记忆冲突 → 待确认', () => {
    const conflictMemory = buildMerchantMemory([
      txn({ id: 'a', counterparty: '某店', category: '餐饮美食', categorySource: 'manual' }),
      txn({ id: 'b', counterparty: '某店', category: '购物消费', categorySource: 'manual' }),
    ]);
    const r = classifyTransactionDetailed(txn({ counterparty: '某店' }), { memory: conflictMemory, amountTimeRules });
    expect(r.category).toBe('待确认');
    expect(r.level).toBe('pending');
  });
});

describe('L4 关键词', () => {
  it('命中品类词 → certain', () => {
    const r = classifyTransactionDetailed(txn({ counterparty: '星巴克咖啡' }), { amountTimeRules });
    expect(r).toMatchObject({ category: '餐饮美食', basis: 'keyword', level: 'certain' });
  });

  it('渠道词不再抢词：云上优家超市归购物', () => {
    const r = classifyTransactionDetailed(
      txn({ counterparty: '美团', description: '云上优家超市（沌口店）-美团App-***' }),
      { amountTimeRules },
    );
    expect(r.category).toBe('购物消费');
    expect(r.basis).toBe('keyword');
  });
});

describe('L5 渠道', () => {
  it('电商型渠道 → 购物，certain', () => {
    const r = classifyTransactionDetailed(txn({ counterparty: '淘宝平台商户', description: '商户单号XP***' }), {
      amountTimeRules,
    });
    expect(r).toMatchObject({ category: '购物消费', basis: 'ecommerce', level: 'certain' });
  });

  it('综合型渠道历史不足 → 不猜', () => {
    const r = classifyTransactionDetailed(txn({ counterparty: '抖音', description: '新客福利精剪+洗吹+造型', amount: 63 }), {
      amountTimeRules,
      channelStats: new Map(),
    });
    expect(r.category).toBe('待确认');
  });

  it('综合型渠道历史达标 → 推测', () => {
    const channelStats = new Map([['美团', new Map([['餐饮美食', 8]])]]);
    const r = classifyTransactionDetailed(
      txn({ counterparty: '美团', description: '', amount: 40, transactionTime: '2026-09-01 12:00:00' }),
      { amountTimeRules: [], channelStats },
    );
    expect(r).toMatchObject({ category: '餐饮美食', basis: 'channel-guess', level: 'guessed' });
  });
});

describe('L6 时段金额（只对无商户记录）', () => {
  it('无商户 + 落在区间 → 推测', () => {
    const r = classifyTransactionDetailed(
      txn({ counterparty: '微信支付', description: '微信支付: 已支付¥22.30', amount: 22.3, transactionTime: '2026-10-01 12:00:00' }),
      { amountTimeRules },
    );
    expect(r).toMatchObject({ category: '餐饮美食', basis: 'amount-time', level: 'guessed' });
  });

  it('有商户时不套用金额规则', () => {
    const r = classifyTransactionDetailed(
      txn({ counterparty: '美团单车', description: '', amount: 15.8, transactionTime: '2026-09-01 16:23:00' }),
      { amountTimeRules },
    );
    expect(r.category).not.toBe('餐饮美食');
  });

  it('超出区间 → 待确认', () => {
    const r = classifyTransactionDetailed(
      txn({ counterparty: '微信支付', description: '微信支付: 已支付¥46.93', amount: 46.93 }),
      { amountTimeRules },
    );
    expect(r).toMatchObject({ category: '待确认', basis: 'none', level: 'pending' });
  });
});
```

- [ ] **Step 2: 跑测试确认失败**

Run: `node node_modules/vitest/vitest.mjs run src/core/classify.test.ts`
Expected: FAIL — 模块不存在

- [ ] **Step 3: 实现**

```ts
// src/core/classify.ts
// ============================================================
// 分类判定编排（六层，第一个命中即返回）
//
//   L1 你设的      → certain
//   L2 资金搬运/收入 → certain
//   L3 商户记忆     → certain（冲突则留白）
//   L4 品类关键词   → certain
//   L5 渠道        → 电商型 certain / 综合型 guessed
//   L6 时段+金额    → guessed（仅无商户记录）
//   兜底           → 待确认
//
// 设计文档：docs/plan-reclassify.md
// ============================================================

import type { ClassificationRule, Transaction } from '@/types';
import { classifyByKeyword } from './keyword-match';
import { extractMerchantKey } from './merchant-key';
import { lookupMerchantMemory, type MerchantMemory } from './merchant-memory';
import { detectChannel } from './channels';
import { matchAmountTimeRule, type AmountTimeRule } from './amount-time-rules';

export type ClassificationBasis =
  | 'user'
  | 'transfer'
  | 'income'
  | 'memory'
  | 'keyword'
  | 'ecommerce'
  | 'channel-guess'
  | 'amount-time'
  | 'none';

export type ClassificationLevel = 'certain' | 'guessed' | 'pending';

export interface ClassificationResult {
  category: string;
  basis: ClassificationBasis;
  level: ClassificationLevel;
  /** 人话依据，供界面展开 */
  reason: string;
  merchantKey: string | null;
}

export interface ClassifyContext {
  customRules?: ClassificationRule[];
  memory?: MerchantMemory;
  amountTimeRules?: AmountTimeRule[];
  /** 渠道 → (分类 → 条数)，由 buildChannelStats 生成 */
  channelStats?: Map<string, Map<string, number>>;
}

export const PENDING_CATEGORY = '待确认';
export const TRANSFER_CATEGORY = '转账';
export const INCOME_CATEGORY = '收入';

/** 渠道历史达到这个条数、且同一分类占比达到这个比例，才允许"推测" */
export const CHANNEL_MIN_SAMPLES = 3;
export const CHANNEL_MIN_RATIO = 0.8;

/** 资金搬运词 */
const TRANSFER_KEYWORDS = ['转账', '红包', '提现', '退款', '还款', '零钱通'];

function channelGuess(
  channel: string,
  stats: Map<string, Map<string, number>> | undefined,
): { category: string; support: number; ratio: number } | null {
  const bucket = stats?.get(channel);
  if (!bucket) return null;
  const total = [...bucket.values()].reduce((a, b) => a + b, 0);
  if (total < CHANNEL_MIN_SAMPLES) return null;
  const [category, count] = [...bucket.entries()].sort((a, b) => b[1] - a[1])[0];
  const ratio = count / total;
  if (ratio < CHANNEL_MIN_RATIO) return null;
  return { category, support: total, ratio };
}

/** 判定并返回完整依据 */
export function classifyTransactionDetailed(
  txn: Transaction,
  ctx: ClassifyContext = {},
): ClassificationResult {
  const text = `${txn.transactionType ?? ''} ${txn.counterparty ?? ''} ${txn.description ?? ''}`;
  const lower = text.toLowerCase();
  const merchantKey = extractMerchantKey(txn);

  // L1 你设的
  if (txn.categorySource === 'manual') {
    return {
      category: txn.category,
      basis: 'user',
      level: 'certain',
      reason: '你手动设置',
      merchantKey,
    };
  }

  // L2 资金搬运 / 收入
  const transferHit = TRANSFER_KEYWORDS.find((w) => lower.includes(w));
  if (transferHit) {
    return {
      category: TRANSFER_CATEGORY,
      basis: 'transfer',
      level: 'certain',
      reason: `含「${transferHit}」，属于资金搬运`,
      merchantKey,
    };
  }
  if (txn.amount < 0) {
    return { category: INCOME_CATEGORY, basis: 'income', level: 'certain', reason: '金额为负（收入）', merchantKey };
  }

  // L3 商户记忆
  const memory = lookupMerchantMemory(ctx.memory ?? new Map(), merchantKey);
  if (memory && 'category' in memory) {
    return {
      category: memory.category,
      basis: 'memory',
      level: 'certain',
      reason: `商户记忆：${merchantKey}`,
      merchantKey,
    };
  }
  if (memory && 'conflict' in memory) {
    return {
      category: PENDING_CATEGORY,
      basis: 'none',
      level: 'pending',
      reason: `商户「${merchantKey}」有不止一种历史分类`,
      merchantKey,
    };
  }

  // L4 品类关键词
  const keyword = classifyByKeyword(txn, { customRules: ctx.customRules });
  if (keyword) {
    return {
      category: keyword.category,
      basis: 'keyword',
      level: 'certain',
      reason: `命中关键词「${keyword.keyword}」`,
      merchantKey,
    };
  }

  // L5 渠道
  const channel = detectChannel(text);
  if (channel?.kind === 'ecommerce') {
    return {
      category: '购物消费',
      basis: 'ecommerce',
      level: 'certain',
      reason: `电商平台「${channel.name}」`,
      merchantKey,
    };
  }
  if (channel) {
    const guess = channelGuess(channel.name, ctx.channelStats);
    if (guess) {
      return {
        category: guess.category,
        basis: 'channel-guess',
        level: 'guessed',
        reason: `「${channel.name}」历史 ${guess.support} 条中 ${Math.round(guess.ratio * 100)}% 是${guess.category}`,
        merchantKey,
      };
    }
  }

  // L6 时段 + 金额（只对抽不出商户的记录）
  if (!merchantKey && ctx.amountTimeRules?.length) {
    const rule = matchAmountTimeRule(txn, ctx.amountTimeRules);
    if (rule) {
      return {
        category: rule.category,
        basis: 'amount-time',
        level: 'guessed',
        reason: `${rule.minAmount}~${rule.maxAmount} 元，历史 ${rule.support} 条中 ${Math.round(rule.hitRate * 100)}% 是${rule.category}`,
        merchantKey,
      };
    }
  }

  // 兜底
  return {
    category: PENDING_CATEGORY,
    basis: 'none',
    level: 'pending',
    reason: '没有任何可用依据',
    merchantKey,
  };
}

/** 只取分类名（兼容旧签名） */
export function classifyTransaction(txn: Transaction, ctx: ClassifyContext = {}): string {
  return classifyTransactionDetailed(txn, ctx).category;
}
```

- [ ] **Step 4: 跑测试确认通过**

Run: `node node_modules/vitest/vitest.mjs run src/core/classify.test.ts`
Expected: PASS

- [ ] **Step 5: 提交**

```bash
git add src/core/classify.ts src/core/classify.test.ts
git commit -m "feat(classify): 六层判定编排（商户记忆/关键词/渠道/时段金额/待确认）"
```

---

### Task 8: 上下文构建器（渠道统计）

**Files:**
- Create: `src/core/classify-context.ts`
- Test: `src/core/classify-context.test.ts`

- [ ] **Step 1: 写失败的测试**

```ts
// src/core/classify-context.test.ts
import { describe, it, expect } from 'vitest';
import type { ClassificationRule, Transaction } from '@/types';
import { buildClassifyContext } from './classify-context';

function txn(partial: Partial<Transaction>): Transaction {
  return {
    id: partial.id ?? 'x',
    transactionTime: '2026-09-01 12:00:00',
    transactionType: '支出',
    counterparty: '',
    description: '',
    amount: 20,
    paymentStatus: '',
    transactionNo: '',
    paymentMethod: '',
    category: '待确认',
    categorySource: 'auto',
    origin: 'import',
    isPeriodic: false,
    tags: [],
    createdAt: '2026-09-01 12:00:00',
    coverImage: '',
    theme: '',
    ...partial,
  };
}

describe('buildClassifyContext', () => {
  it('用已确认记录构建记忆与时段金额规则', () => {
    const txns = Array.from({ length: 6 }, (_, i) =>
      txn({ id: `m${i}`, counterparty: '塔斯汀', amount: 22, category: '餐饮美食', categorySource: 'manual' }),
    );
    const ctx = buildClassifyContext(txns, [] as ClassificationRule[]);
    expect(ctx.memory?.size).toBeGreaterThan(0);
    expect(ctx.amountTimeRules?.length).toBeGreaterThan(0);
  });

  it('渠道统计只统计已确认记录', () => {
    const txns = [
      txn({ id: 'a', counterparty: '美团', category: '餐饮美食', categorySource: 'manual' }),
      txn({ id: 'b', counterparty: '美团', category: '餐饮美食', categorySource: 'manual' }),
      txn({ id: 'c', counterparty: '美团', category: '餐饮美食', categorySource: 'manual' }),
      txn({ id: 'd', counterparty: '美团', category: '交通出行', categorySource: 'guessed' }),
    ];
    const ctx = buildClassifyContext(txns, []);
    expect(ctx.channelStats?.get('美团')?.get('餐饮美食')).toBe(3);
    expect(ctx.channelStats?.get('美团')?.get('交通出行')).toBeUndefined();
  });
});
```

- [ ] **Step 2: 跑测试确认失败**

Run: `node node_modules/vitest/vitest.mjs run src/core/classify-context.test.ts`
Expected: FAIL

- [ ] **Step 3: 实现**

```ts
// src/core/classify-context.ts
// ============================================================
// 分类上下文构建：从交易数据算出记忆、时段金额规则、渠道统计。
//
// 三者都不落库，每次现算——永远和最新数据一致，也不需要为学习结果做迁移。
// 代价是每次分类多一遍扫描；千级数据量下可忽略，调用方按数组引用缓存即可。
// ============================================================

import type { ClassificationRule, Transaction } from '@/types';
import { buildMerchantMemory, type MerchantMemory } from './merchant-memory';
import { induceAmountTimeRules, type AmountTimeRule } from './amount-time-rules';
import { detectChannel } from './channels';
import type { ClassifyContext } from './classify';

export interface BuiltClassifyContext extends ClassifyContext {
  memory: MerchantMemory;
  amountTimeRules: AmountTimeRule[];
  channelStats: Map<string, Map<string, number>>;
}

function buildChannelStats(transactions: Transaction[]): Map<string, Map<string, number>> {
  const stats = new Map<string, Map<string, number>>();
  for (const txn of transactions) {
    if (txn.categorySource !== 'manual' || !txn.category) continue;
    const channel = detectChannel(`${txn.counterparty ?? ''} ${txn.description ?? ''}`);
    if (!channel) continue;
    const bucket = stats.get(channel.name) ?? new Map<string, number>();
    bucket.set(txn.category, (bucket.get(txn.category) ?? 0) + 1);
    stats.set(channel.name, bucket);
  }
  return stats;
}

export function buildClassifyContext(
  transactions: Transaction[],
  customRules: ClassificationRule[] = [],
): BuiltClassifyContext {
  return {
    customRules,
    memory: buildMerchantMemory(transactions),
    amountTimeRules: induceAmountTimeRules(transactions),
    channelStats: buildChannelStats(transactions),
  };
}
```

- [ ] **Step 4: 跑测试确认通过**

Run: `node node_modules/vitest/vitest.mjs run src/core/classify-context.test.ts`
Expected: PASS

- [ ] **Step 5: 提交**

```bash
git add src/core/classify-context.ts src/core/classify-context.test.ts
git commit -m "feat(classify): 上下文构建器（记忆/时段规则/渠道统计，全部现算）"
```

---

## 批次 2：接入调用点（行为此时才改变）

> 5 个调用点必须一次性改完，否则同一份数据在不同页面会有不同分类。
> 每个任务改完立刻跑全量测试，红一条就停下来修。

### Task 9: 改造 `classifier.ts` 为薄封装

**Files:**
- Modify: `src/core/classifier.ts`
- Test: `src/core/classifier.test.ts`（改写旧断言）

- [ ] **Step 1: 改写旧测试里依赖"渠道词抢先"的用例**

把 `src/core/classifier.test.ts` 中这些断言改掉：

```ts
// 旧：美团 → 餐饮美食
// 新：美团是渠道，不该直接命中餐饮；无店名时按渠道层处理
it('美团不再直接命中餐饮（渠道词不参与关键词匹配）', () => {
  expect(classifyTransaction(makeTxn({ counterparty: '美团' }))).toBe('待确认')
})

it('美团 + 店名 → 按店名判', () => {
  expect(
    classifyTransaction(makeTxn({ counterparty: '美团', description: '塔斯汀·中国汉堡-美团App-***' })),
  ).toBe('餐饮美食')
})
```

- [ ] **Step 2: 跑测试确认失败**

Run: `node node_modules/vitest/vitest.mjs run src/core/classifier.test.ts`
Expected: FAIL（新断言未满足）

- [ ] **Step 3: 让 `classifier.ts` 委托新引擎**

```ts
// src/core/classifier.ts —— 保留对外签名，实现改为委托
import type { ClassificationRule, Transaction } from '@/types';
import { classifyTransaction as classify, classifyTransactionDetailed } from './classify';

export { classifyTransactionDetailed } from './classify';

/** 分类单条交易（返回分类名）。上下文由调用方按需传入。 */
export function classifyTransaction(txn: Transaction, customRules: ClassificationRule[] = []): string {
  return classify(txn, { customRules });
}

// classifyTransactions / processFeedback / isValidCategory / getCategoryNames 保持原实现不变，
// 只把内部调用改成 classifyTransaction(txn, customRules)
```

- [ ] **Step 4: 跑测试确认通过**

Run: `node node_modules/vitest/vitest.mjs run src/core/classifier.test.ts`
Expected: PASS

- [ ] **Step 5: 提交**

```bash
git add src/core/classifier.ts src/core/classifier.test.ts
git commit -m "refactor(classify): classifier 委托六层引擎，保留旧签名"
```

---

### Task 10: 五个调用点接入上下文

**Files:**
- Modify: `src/hooks/useAutoLedger.ts:77`
- Modify: `src/components/transactions/UploadZone.tsx:91`
- Modify: `src/core/transaction-reconcile.ts:174`
- Modify: `src/pages/Transactions.tsx:249`
- Modify: `src/stores/transaction-store.ts:174`

- [ ] **Step 1: 写一个集成测试（导入路径）**

```ts
// src/core/classify-integration.test.ts
import { describe, it, expect } from 'vitest';
import type { Transaction } from '@/types';
import { buildClassifyContext } from './classify-context';
import { classifyTransactionDetailed } from './classify';

function txn(partial: Partial<Transaction>): Transaction {
  return {
    id: partial.id ?? 'x',
    transactionTime: '2026-10-01 12:00:00',
    transactionType: '支出',
    counterparty: '',
    description: '',
    amount: 22,
    paymentStatus: '',
    transactionNo: '',
    paymentMethod: '',
    category: '待确认',
    categorySource: 'auto',
    origin: 'import',
    isPeriodic: false,
    tags: [],
    createdAt: '2026-10-01 12:00:00',
    coverImage: '',
    theme: '',
    ...partial,
  };
}

describe('端到端：同一份上下文下结果稳定', () => {
  it('历史确认过的商户，新记录能沿用', () => {
    const history = [
      txn({ id: 'h1', counterparty: '藕小厨', category: '餐饮美食', categorySource: 'manual' }),
      txn({ id: 'h2', counterparty: '藕小厨', category: '餐饮美食', categorySource: 'manual' }),
    ];
    const ctx = buildClassifyContext(history, []);
    const next = txn({ id: 'n1', counterparty: '藕小厨', description: '' });
    expect(classifyTransactionDetailed(next, ctx)).toMatchObject({ category: '餐饮美食', basis: 'memory' });
  });

  it('无信息通知按时段金额给推测', () => {
    const history = Array.from({ length: 6 }, (_, i) =>
      txn({ id: `h${i}`, counterparty: '某店', amount: 22, category: '餐饮美食', categorySource: 'manual' }),
    );
    const ctx = buildClassifyContext(history, []);
    const notice = txn({ id: 'n', counterparty: '微信支付', description: '微信支付: 已支付¥22.30', amount: 22.3 });
    const r = classifyTransactionDetailed(notice, ctx);
    expect(r.level).toBe('guessed');
    expect(r.basis).toBe('amount-time');
  });
});
```

- [ ] **Step 2: 跑测试确认失败**

Run: `node node_modules/vitest/vitest.mjs run src/core/classify-integration.test.ts`
Expected: PASS（纯函数已就绪）——此测试是为了保证集成后行为不回退，不是红→绿。

- [ ] **Step 3: 逐点接入**

`src/hooks/useAutoLedger.ts`：
```ts
// 顶部：把 habit 模型缓存换成分类上下文缓存（同样是"数组引用变化才重建"）
import { buildClassifyContext } from '@/core/classify-context';
import type { BuiltClassifyContext } from '@/core/classify-context';
import { classifyTransactionDetailed } from '@/core/classify';

let cachedCtxKey: Transaction[] | null = null;
let cachedCtx: BuiltClassifyContext | null = null;
function getClassifyContext(transactions: Transaction[], rules: ClassificationRule[]): BuiltClassifyContext {
  if (cachedCtxKey !== transactions || cachedCtx === null) {
    cachedCtx = buildClassifyContext(transactions, rules);
    cachedCtxKey = transactions;
  }
  return cachedCtx;
}

// processCapture 内：
const ctx = getClassifyContext(store.transactions, useClassificationStore.getState().customRules);
const result = classifyTransactionDetailed(txn, ctx);
store.addTransaction({
  ...txn,
  category: result.category,
  categorySource: result.level === 'guessed' ? 'guessed' : 'auto',
  classifyBasis: result.basis,
  classifyReason: result.reason,
});
```
删除 `buildHabitModel` / `getHabitModel` 的调用与导入。

`src/components/transactions/UploadZone.tsx`：
```ts
const ctx = buildClassifyContext(masked, allRules);
const classified = masked.map((t) => {
  const r = classifyTransactionDetailed(t, ctx);
  return { ...t, category: r.category, categorySource: r.level === 'guessed' ? 'guessed' : 'auto',
           classifyBasis: r.basis, classifyReason: r.reason };
});
```

`src/core/transaction-reconcile.ts`：把 `classifyTransaction(base, customRules)` 改为
```ts
const result = classifyTransactionDetailed(base, ctx);
// 回填时写入 category + categorySource + classifyBasis/Reason
```
并给 `reconcileImportedBills` 增加参数 `ctx: ClassifyContext = {}`。

`src/pages/Transactions.tsx:249`（重新识别）：同样改为 `classifyTransactionDetailed(t, ctx)`，`ctx` 用当前交易列表构建。

`src/stores/transaction-store.ts:174`（迁移里的重判）：改为 `classifyTransaction(next, { customRules: [] })`（迁移阶段不引入记忆，避免用旧数据自证）。

- [ ] **Step 4: 给 `Transaction` 加两个可选字段**

```ts
// src/types/index.ts
/** 分类依据（诊断与界面展示用，不参与判定） */
classifyBasis?: 'user' | 'transfer' | 'income' | 'memory' | 'keyword' | 'ecommerce' | 'channel-guess' | 'amount-time' | 'none';
/** 分类依据的人话说明 */
classifyReason?: string;
```

- [ ] **Step 5: 跑全量测试 + 类型检查**

Run:
```bash
node node_modules/vitest/vitest.mjs run
node node_modules/typescript/bin/tsc -b --force --pretty false
```
Expected: 全部通过；`tsc` exit 0。若有红，按报错修，不要放宽断言。

- [ ] **Step 6: 提交**

```bash
git add -A
git commit -m "feat(classify): 5 个调用点接入六层引擎，捕获/导入/回填/重识别/迁移统一口径"
```

---

### Task 11: 回放验证（真实数据）

**Files:**
- Create: `src/core/replay-classify.test.ts`

- [ ] **Step 1: 写一个默认跳过的回放用例**

仓库里没有 `vite-node`/`tsx`，不要为跑一次回放引新依赖。用 Vitest 的 `skipIf` + 环境变量：

```ts
// src/core/replay-classify.test.ts
// 默认跳过；把 PFD_BACKUP 指向一份备份 JSON 时才执行。
// 例：PFD_BACKUP="C:/path/记账备份_已脱敏_2026-10-18.json" node node_modules/vitest/vitest.mjs run src/core/replay-classify.test.ts
// 备份文件绝不进仓库（只在本地读）。
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import type { Transaction } from '@/types';
import { buildClassifyContext } from './classify-context';
import { classifyTransactionDetailed } from './classify';

const backupPath = process.env.PFD_BACKUP;

describe.skipIf(!backupPath)('真实备份回放', () => {
  it('输出依据等级分布，且必须有留白', () => {
    const raw = JSON.parse(readFileSync(backupPath!, 'utf8'));
    const txns: Transaction[] = raw.pfd_transactions ?? [];
    const ctx = buildClassifyContext(txns, raw.pfd_custom_rules ?? []);

    const levels = new Map<string, number>();
    const changes: string[] = [];
    for (const t of txns) {
      const r = classifyTransactionDetailed(t, ctx);
      levels.set(r.level, (levels.get(r.level) ?? 0) + 1);
      if (r.category !== t.category) {
        changes.push(
          `${t.transactionTime?.slice(0, 10)} ${t.amount} ${t.category}(${t.categorySource}) → ${r.category} [${r.level}] ${r.reason}`,
        );
      }
    }
    console.log('等级分布:', [...levels.entries()].map(([k, v]) => `${k}=${v}`).join('  '));
    console.log(`与库中不同: ${changes.length}/${txns.length}`);
    changes.slice(0, 40).forEach((c) => console.log('  ' + c));

    expect(txns.length).toBeGreaterThan(0);
    // 关键断言：不允许"全确定"——没有依据的记录必须留白
    expect(levels.get('pending') ?? 0).toBeGreaterThan(0);
  });
});
```

- [ ] **Step 2: 用真实备份跑一遍**

Run:
```bash
PFD_BACKUP="C:/Users/86180/xwechat_files/wxid_m03p7sn7u42922_dc9f/msg/file/2026-10/记账备份_已脱敏_2026-10-18.json" node node_modules/vitest/vitest.mjs run src/core/replay-classify.test.ts
```
Expected: 先打印等级分布，再打印差异明细。分布应接近设计文档 §7（certain≈72%、guessed≈23%、pending≈5%）。偏差超过 10 个百分点就停下来查逻辑，**不要改断言迁就代码**。

- [ ] **Step 3: 提交**

```bash
git add src/core/replay-classify.test.ts
git commit -m "test(classify): 回放用例（默认跳过，用 PFD_BACKUP 指向真实备份）"
```

---

## 批次 3：新增「收入」类别

### Task 12: 类别定义与文案

**Files:**
- Modify: `src/types/index.ts`（CATEGORIES）
- Modify: `src/i18n/messages/zh-CN/dataLabels.ts`、`src/i18n/messages/en/dataLabels.ts`
- Modify: `src/i18n/labels.ts`
- Modify: `src/components/ui/CategoryIcon.tsx`
- Test: `src/i18n/labels.test.ts`

- [ ] **Step 1: 写测试**

```ts
// src/i18n/labels.test.ts 追加
it('收入类别有中文与英文标签', () => {
  expect(categoryLabel('zh-CN', '收入')).toBe('收入');
  expect(categoryLabel('en', '收入')).toBe('Income');
});
```

- [ ] **Step 2: 跑测试确认失败**

Run: `node node_modules/vitest/vitest.mjs run src/i18n/labels.test.ts`
Expected: FAIL（返回的还是 '收入' 原文，英文断言失败）

- [ ] **Step 3: 实现**

```ts
// src/types/index.ts
export const CATEGORIES = [
  // …原有 10 项…
  { name: '收入', icon: '💰', color: '#22C55E' },
] as const;
```

```ts
// src/i18n/messages/zh-CN/dataLabels.ts
'category.income': '收入',

// src/i18n/messages/en/dataLabels.ts
'category.income': 'Income',

// src/i18n/labels.ts
收入: 'category.income',

// src/components/ui/CategoryIcon.tsx
// ⚠️ 这张表是 Record<string, LucideIcon>，不是强类型映射——漏了不会编译报错，
// 只会静默回退成 Tag 图标。所以必须显式加。
import { Wallet } from 'lucide-react';
const CATEGORY_ICONS: Record<string, LucideIcon> = {
  // …原有 10 项…
  收入: Wallet,
};
```

- [ ] **Step 4: 跑测试 + 类型检查**

Run:
```bash
node node_modules/vitest/vitest.mjs run src/i18n/labels.test.ts src/i18n/messages.test.ts
node node_modules/typescript/bin/tsc -b --force --pretty false
```
Expected: 全绿；`tsc` 若报"`收入` 未在 Record 中"，说明 labels.ts 漏改。

- [ ] **Step 5: 提交**

```bash
git add -A
git commit -m "feat(category): 新增「收入」类别（图标/配色/双语标签）"
```

---

### Task 13: 统计口径与预算过滤

**Files:**
- Modify: `src/core/transaction-query.ts`（isConsumption）
- Modify: `src/core/budget-engine.ts` 或预算页（过滤收入）
- Test: `src/core/transaction-query.test.ts`

- [ ] **Step 1: 写测试**

```ts
// src/core/transaction-query.test.ts 追加
it('收入类别不计入消费支出', () => {
  expect(isConsumption(txn({ amount: 100, category: '收入' }))).toBe(false);
});

it('收入类别不是转账，仍可单独统计', () => {
  expect(isConsumption(txn({ amount: 100, category: '收入' }))).toBe(false);
  expect(isConsumption(txn({ amount: 100, category: '餐饮美食' }))).toBe(true);
});
```

- [ ] **Step 2: 跑测试确认失败**

Run: `node node_modules/vitest/vitest.mjs run src/core/transaction-query.test.ts`
Expected: FAIL

- [ ] **Step 3: 实现**

```ts
// src/core/transaction-query.ts
export const INCOME_CATEGORY = '收入';

export function isConsumption(txn: Transaction): boolean {
  return (
    txn.amount > 0 &&
    txn.category !== TRANSFER_CATEGORY &&
    txn.category !== INCOME_CATEGORY &&
    txn.transactionType !== '其他'
  );
}
```

预算页过滤（`src/components/budget/BudgetEditor.tsx:50`，现有代码已排除「待确认」，再加一个）：
```ts
const availableCategories = CATEGORIES.filter(
  (c) => c.name !== '待确认' && c.name !== '收入' && !budgetedCategories.has(c.name),
);
```

> 其余下拉（明细批量设分类、详情弹窗、分类规则、读取规则）**不要**过滤「收入」——
> 用户需要能给一笔收款手动指定「收入」。

- [ ] **Step 4: 跑全量测试**

Run: `node node_modules/vitest/vitest.mjs run`
Expected: 全绿。若某个图表/报告测试断言分类数量，按新数量更新断言（不是删断言）。

- [ ] **Step 5: 提交**

```bash
git add -A
git commit -m "feat(category): 收入不计入消费支出，预算页排除收入与待确认"
```

---

### Task 14: 一次性迁移（负数记录 → 收入）

**Files:**
- Modify: `src/types/index.ts`（STORAGE_KEYS 增加迁移标记）
- Modify: `src/stores/transaction-store.ts`（loadFromStorage 迁移块）
- Test: `src/stores/transaction-store.test.ts`

- [ ] **Step 1: 写测试**

```ts
// src/stores/transaction-store.test.ts 追加（沿用文件里已有的 fake / txn / flushPersist）
it('迁移：负数记录且非转账/收入 → 收入', async () => {
  fake[STORAGE_KEYS.TRANSACTIONS] = JSON.stringify([
    txn({ id: 'a', amount: -1800, category: '居住生活', categorySource: 'manual' }),
    txn({ id: 'b', amount: 100, category: '居住生活', categorySource: 'manual' }),
    txn({ id: 'c', amount: -200, category: '转账', categorySource: 'manual' }),
  ]);
  useTransactionStore.setState({ transactions: [], loaded: false });
  await useTransactionStore.getState().loadFromStorage();

  const byId = new Map(useTransactionStore.getState().transactions.map((t) => [t.id, t]));
  expect(byId.get('a')!.category).toBe('收入');
  expect(byId.get('b')!.category).toBe('居住生活');
  expect(byId.get('c')!.category).toBe('转账');
});

it('迁移只跑一次：用户后来改回的分类不会被再次覆盖', async () => {
  fake[STORAGE_KEYS.TRANSACTIONS] = JSON.stringify([
    txn({ id: 'a', amount: -1800, category: '居住生活', categorySource: 'manual' }),
  ]);
  useTransactionStore.setState({ transactions: [], loaded: false });
  await useTransactionStore.getState().loadFromStorage();
  await flushPersist();

  // 用户把它改回居住生活
  useTransactionStore.getState().updateCategory('a', '居住生活');
  await flushPersist();

  // 模拟下次启动：重新加载，迁移不该再动它
  useTransactionStore.setState({ transactions: [], loaded: false });
  await useTransactionStore.getState().loadFromStorage();
  expect(useTransactionStore.getState().transactions[0].category).toBe('居住生活');
});
```

- [ ] **Step 2: 跑测试确认失败**

Run: `node node_modules/vitest/vitest.mjs run src/stores/transaction-store.test.ts`
Expected: FAIL

- [ ] **Step 3: 实现**

```ts
// src/types/index.ts —— STORAGE_KEYS 增加
MIGRATION_INCOME_V1: 'pfd_mig_income_v1',
```

```ts
// src/stores/transaction-store.ts —— 迁移块内（在 theme/coverImage 补齐之后）
// 一次性迁移：金额为负且分类不是转账/收入 → 收入
// 旧版本没有「收入」类别，工资/理赔这类收入被迫塞进了支出口径（如「居住生活」）。
// 只跑一次（用存储标记把关），否则会把用户后来手改的分类反复覆盖掉。
const incomeMigrated = await storage.get<boolean>(STORAGE_KEYS.MIGRATION_INCOME_V1);
if (!incomeMigrated) {
  const before = next.category;
  if (next.amount < 0 && before !== '转账' && before !== '收入') {
    next = { ...next, category: '收入' };
  }
}
// 循环外：
if (!incomeMigrated) {
  await storage.set(STORAGE_KEYS.MIGRATION_INCOME_V1, true);
}
```

> 注意：`CATEGORY_FEEDBACK` 里若有旧分类的统计，不需要同步改——反馈只用于规则升级，不影响历史记录。

- [ ] **Step 4: 跑测试**

Run: `node node_modules/vitest/vitest.mjs run src/stores/transaction-store.test.ts`
Expected: PASS

- [ ] **Step 5: 提交**

```bash
git add -A
git commit -m "feat(migrate): 一次性把负数记录修正为收入（标记位保证只跑一次）"
```

---

## 批次 4：界面

### Task 15: 分类标签显示依据

**Files:**
- Modify: `src/components/transactions/CategoryTag.tsx`
- Test: 无单测（node 环境无 DOM），靠 Task 17 的浏览器冒烟

- [ ] **Step 1: 让「推测」标签与详情弹窗都能说明依据**

```tsx
// CategoryTag.tsx
// props 增加：reason?: string
{source === 'guessed' && (
  <span
    className="ml-0.5 text-[10px] opacity-70"
    title={reason ?? t('transactions.tag.guessedTitle')}
  >
    {t('transactions.tag.guessed')}
  </span>
)}
```

```tsx
// TransactionDetailModal.tsx —— 在分类行下面加一行依据（所有等级都显示，读屏可读）
{txn.classifyReason && (
  <p className="mt-1 text-xs text-ink-subtle">
    {t('transactions.detail.basis', { reason: txn.classifyReason })}
  </p>
)}
```

```ts
// src/i18n/messages/zh-CN/transactions.ts
'transactions.detail.basis': '分类依据：{reason}',
// src/i18n/messages/en/transactions.ts
'transactions.detail.basis': 'Why: {reason}',
```

- [ ] **Step 2: 在调用处传 reason**

`src/pages/Transactions.tsx` 与详情弹窗里，把 `txn.classifyReason` 传给 `CategoryTag`。

- [ ] **Step 3: 类型检查 + 构建**

Run:
```bash
node node_modules/typescript/bin/tsc -b --force --pretty false
node node_modules/oxlint/bin/oxlint
node node_modules/vite/bin/vite.js build
```
Expected: 三条全绿（oxlint 输出 `Found 0 warnings and 0 errors`）

- [ ] **Step 4: 提交**

```bash
git add -A
git commit -m "feat(ui): 「推测」标签展示分类依据"
```

---

### Task 16:（可选）设置页展示商户记忆

> **本次实施可以跳过。** 记忆是从交易数据现算的，规则出错时用户改一次分类即可纠正；在还没有"记忆看不过来"的真实反馈之前做这个页面属于过度设计（YAGNI）。
> 如果后面发现需要"看清系统记住了哪些商户"，再做，届时本节按下面的要点实现。

**Files:**
- Create: `src/components/settings/MerchantMemoryList.tsx`
- Modify: `src/pages/SettingsRules.tsx`（分类规则所在页）

- [ ] **Step 1: 只读列表**

```tsx
// MerchantMemoryList.tsx
// 数据：buildMerchantMemory(transactions) 现算，取前 50 条
// 列：商户键 / 分类 / 冲突标记（conflict 时显示「有两种历史分类」）
// 样式沿用该页现有卡片列表，不新增路由、不新增存储
```

- [ ] **Step 2: 跑全量测试 + 构建**

Run:
```bash
node node_modules/vitest/vitest.mjs run
node node_modules/vite/bin/vite.js build
```
Expected: 全绿

- [ ] **Step 3: 提交**

```bash
git add -A
git commit -m "feat(ui): 设置页展示商户记忆（只读）"
```

---

### Task 17: 真实浏览器冒烟（必须做）

**Files:** 无改动，仅验证

- [ ] **Step 1: 构建并用真实数据冒烟**

按 `docs/plan-batch6.md` §7 记录的流程：build → preview → 用临时 `__seed.html` 往 localStorage 灌 100+ 条真实结构交易 → 无头 Edge 打开 8 条路由 → 断言 DOM 里没有「页面出错」、控制台没有 JS 报错。

```bash
node node_modules/vite/bin/vite.js build
node node_modules/vite/bin/vite.js preview --port 4173 --strictPort
```

- [ ] **Step 2: 记录结果**

把 8 条路由的检查结果写进 `docs/plan-reclassify.md` 的「实施记录」一节。

- [ ] **Step 3: 提交文档**

```bash
git add docs/plan-reclassify.md
git commit -m "docs: 分类重构实施记录与冒烟结果"
```

---

## 验收清单

- [ ] 全量单测通过（预期 600+ 条）
- [ ] `tsc -b --force` exit 0
- [ ] `oxlint` 0 warning
- [ ] `vite build` 成功
- [ ] 回放脚本在真实备份上的等级分布与设计文档误差 < 10 个百分点
- [ ] 8 条路由浏览器冒烟无错误
- [ ] `git status` 干净，全部提交已推送

## 已知风险

| 风险 | 应对 |
|---|---|
| 改分类源会让历史数据在某次导入后被重判 | 回填只改 `categorySource !== 'manual'`，且 L2/L3 优先，改动面比旧版更小 |
| 商户键归一化过度合并（不同店同前缀） | 只做"去分店括号 + `·` 截断"，不做模糊前缀匹配 |
| 时段金额规则过拟合（样本仅 20 条） | 阈值 支持≥5、纯度≥80%；输出标「推测」；规则不写进记忆 |
| 收入类别影响图表与预算 | Task 13 一次性改口径并跑全量测试 |
| 旧数据迁移误伤用户手改 | 迁移用标记位只跑一次，并有专门用例覆盖 |
