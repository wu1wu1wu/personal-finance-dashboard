# 自动分类方案：账单回填 + 待确认收件箱 + 习惯学习

> 状态：设计稿（尚未实现）
> 背景：微信支付通知只包含「已支付 ¥23.00」，没有商户名和商品说明，所以自动捕获到的记录只有金额、时间和收支方向，无法分类。

---

## 1. 目标

1. **账单回填（A 路线）**：用微信账单导出（唯一权威数据源）补齐商户、商品、真实交易单号，并据此正确分类。
2. **待确认收件箱**：回填之前的窗口期（账单导出前），自动捕获的记录只能靠人确认，提供一个低成本的批量归类入口。
3. **习惯学习**：从历史账单里学「金额 + 时段 → 分类」，让待确认的数量随时间下降。

原则：**不猜就没有分类，猜了就明确标注**。宁可留在待确认，也不要静默填错。

---

## 2. 现有可复用的资产

| 能力 | 位置 | 用途 |
|---|---|---|
| 微信账单解析（对方 / 商品 / 单号 / 收支） | `src/core/csv-parser.ts` | 回填的数据来源 |
| 关键词规则 + 自定义规则 + 反馈学习 | `src/core/classifier.ts` | 回填后重新分类 |
| UUID v5 确定性去重 | `src/utils/id.ts` | 防止重复导入 |
| 通知 / 短信 → 交易 | `src/core/transaction-capture.ts`、`src/hooks/useAutoLedger.ts` | 占位记录的来源 |
| 筛选 / 排序 / 汇总 | `src/core/transaction-query.ts` | 收件箱列表复用 |
| 分类聚合（看板 / 预算） | `src/core/dashboard-engine.ts`、`budget-engine.ts` | 不因新分类而失效 |

结论：三个模块都能在现有分层上落地，不需要引入新依赖、不需要后端。

---

## 3. 数据模型变更

### 3.1 新增 origin 字段

```ts
/** 记录来源：账单导入 / 手动添加 / 自动捕获（通知或短信） */
origin: 'import' | 'manual' | 'auto';
```

**为什么必须加**：只有自动捕获的占位记录才允许被账单回填覆盖。没有这个字段就无法安全区分「这条记录是权威数据」还是「这条只是金额占位」。

**老数据迁移**：`transactionNo` 以 `auto-` 开头的判定为 `auto`，否则为 `import`。迁移在 `loadFromStorage` 里做一次，与已有的迁移逻辑放在一起。

### 3.2 categorySource 扩展

```ts
categorySource: 'auto' | 'manual' | 'guessed';
```

- `auto`：关键词规则命中（可信）
- `manual`：用户手动指定（最高优先级，任何回填/学习都不得覆盖）
- `guessed`：习惯学习推测（UI 显示「推测」小标，可一键修正）

---

## 4. 模块一：账单回填

### 4.1 新纯函数模块

`src/core/transaction-reconcile.ts`

```ts
export interface ReconcileResult {
  /** 被账单补全的占位记录（id 不变） */
  enriched: Transaction[];
  /** 账单里有、但没有对应占位的全新记录 */
  added: Transaction[];
  /** 诊断用：被回填数量 / 新增数量 */
  stats: { enrichedCount: number; addedCount: number };
}

export function reconcileImportedBills(
  existing: Transaction[],
  imported: Transaction[],
): ReconcileResult;
```

### 4.2 匹配规则（必须确定性）

1. 候选占位：`origin === 'auto'` 且 `categorySource !== 'manual'`。
2. 金额按**分**比较，必须完全相等（避免浮点误差）。
3. 收支方向必须一致。
4. 时间窗口：账单交易时间与占位时间相差不超过 **24 小时**。
   窗口与导出频率无关：账单一个月导一次也能正常回填，因为占位记录存的是真实支付时间（见 4.4）。
5. 多条候选时取时间差最小的一条；一条占位只能被使用一次（按时间差升序贪心配对，保证一对一）。
6. 匹配成功后的处理：
   - 覆盖 `counterparty`、`description`、`transactionNo`、`transactionTime`、`paymentMethod`
   - **保留 `id`**：用户可能已经给占位记录加了封面图、标签，重建会丢
   - `origin` 改为 `'import'`
   - 重新跑一次分类（`categorySource` 不是 `manual` 时）
7. 未匹配的账单记录：走原有 `addTransactions` 新增。

### 4.3 接入点

`src/components/transactions/UploadZone.tsx` 里调用 `addTransactions` 的位置，改为：

1. 先按已有 id 去重（原逻辑）
2. 剩下的交给 `reconcileImportedBills`
3. 把 `enriched` 用 store 的新 action `applyReconcile` 写回，`added` 走 `addTransactions`

### 4.4 前置修复：占位记录必须存真实支付时间

**现状（缺陷）**：`src/hooks/useAutoLedger.ts` 的 `processCapture` 用 `localDateTime()` 写 `transactionTime`，
那是「App 处理这条捕获的时间」，不是「支付发生的时间」。原生端其实已经拿到了准确时间戳（`data.timestamp`），
但只把它编码进了 `transactionNo`。

**影响**：通知在后台被抓到、App 几小时后才回到前台处理时，记录时间会偏几小时。回填匹配完全依赖时间，
这个偏差会直接导致匹配失准。

**修复**：`transactionTime` 改为由 `data.timestamp`（通知投递时刻，即支付时刻）换算成本地时间字符串。
修复后占位时间与账单交易时间通常只差几秒到几分钟，回填不再依赖「导出得够勤」。

**顺序要求**：这一步必须先做，否则回填的匹配准确率无从保证。

---

## 5. 模块二：待确认收件箱

### 5.1 定义

「待确认」= `category === '待确认'`。

### 5.2 UI 方案（不新增路由）

- **明细页**：筛选栏加一个「待确认」快捷筛选（等价于分类筛选，但走 URL 参数 `?pending=1`）。
- **看板**：顶部一张入口卡片「N 笔待确认」，点击跳转 `/transactions?pending=1`。
- **每条记录**：详情弹窗里给一排大按钮，列出常用分类（按用户历史出现频次排序，最多 6 个）+「全部分类」。

理由：复用现有列表和详情弹窗，手机上少一层跳转，改动面最小。

### 5.3 行为

点击分类 → `updateCategory`（已有）→ `categorySource` 变 `manual` → 同时记录反馈（已有 `recordFeedback`，累计 3 次自动升级为自定义规则）。

---

## 6. 模块三：习惯学习

### 6.1 数据来源

只使用 `origin === 'import'`（账单回填或导入，带真实商户）的记录作为训练集。占位和推测记录不参与，避免自我强化错误。

### 6.2 模型

`src/core/habit-learner.ts`

```ts
export interface HabitPrediction { category: string; confidence: number }
export interface HabitModel {
  predict(txn: Transaction): HabitPrediction | null;
  /** 诊断用：样本量、命中率 */
  stats: { samples: number; buckets: number };
}

export function buildHabitModel(history: Transaction[]): HabitModel;
```

特征：

- 金额分档：0-5、5-10、10-20、20-50、50-100、100+
- 时段分档：6-10、10-14、14-18、18-22、22-6

预测规则：

- 该分桶样本数 ≥ 5，且最高频分类占比 ≥ 70% → 返回该分类，置信度 = 占比
- 否则返回 `null`（继续保持待确认）

### 6.3 计算时机与存储

**运行时不预计算、不落库**：每次从 `transactions` 现算（数据量在千级时开销可忽略），用 `useMemo` 缓存。好处是永远和最新数据一致，也不需要为学习结果做版本迁移。

### 6.4 应用时机

`useAutoLedger.processCapture` 中：

1. 先跑 `classifyTransaction`（关键词规则）
2. 若结果是「待确认」，再问 `habitModel.predict`
3. 命中则写入该分类，`categorySource = 'guessed'`

---

## 7. 实施顺序（每步可独立验证）

| 步骤 | 内容 | 验证方式 |
|---|---|---|
| 1 | 占位记录改用真实支付时间（见 4.4） | 单测：给定历史时间戳，确认记录时间等于支付时刻而非处理时刻 |
| 2 | 数据模型变更 + 老数据迁移 | 单测 + 真机看老数据不丢 |
| 3 | `transaction-reconcile.ts` | 纯函数单测（金额配对、24 小时窗口、时间最近优先、一对一、保 id） |
| 4 | 导入流程接入回填 | 导入一份真实账单，看占位是否被补全且不重复 |
| 5 | 待确认收件箱 UI | 真机点几下归类，看统计与规则学习是否生效 |
| 6 | `habit-learner.ts` | 纯函数单测（阈值边界、样本不足返回 null） |
| 7 | 接入推测分类 + 「推测」标记 | 真机确认待确认数量下降 |

---

## 8. 风险与对策

| 风险 | 对策 |
|---|---|
| 同金额多笔误配 | 24 小时窗口 + 时间差最小 + 一对一配对；金额与收支方向本来一致，误配只会导致商户名张冠李戴 |
| 占位记录时间不准导致匹配失败 | 先做 4.4 的前置修复，用真实支付时间 |
| 回填覆盖用户编辑 | 只动 `origin === 'auto' && categorySource !== 'manual'`；保留 `id`，封面与标签不丢 |
| 推测分类填错 | 高阈值（≥5 样本、≥70%）+ 明确标「推测」+ 一键可改 |
| 账单新鲜度决定回填质量 | 建议每周导出一次；可选加「上次导入时间」提醒 |

---

## 9. 已确定的决策

1. **转账不计入支出统计与分类饼图**，只在明细里展示。
2. **收件箱复用明细页**（加「待确认」快捷筛选），看板顶部放入口，不新增路由。
3. **推测分类参与预算与图表**，但带「推测」标记。
4. **回填时间窗口 24 小时**，并且必须先做 4.4 的占位时间修复（窗口宽不等于可以容忍时间不准）。

---

## 10. 「支出」口径变更的影响面（因决策 1）

全站统一口径：**「支出」不含转账**。凡是把 `amount > 0` 当作支出的地方都要加排除条件。

| 位置 | 涉及内容 |
|---|---|
| `src/core/dashboard-engine.ts` | 月度趋势的支出、分类占比、每日支出、KPI 总支出与最大单笔 |
| `src/core/budget-engine.ts` | 分类预算已花金额、总预算已花金额 |
| `src/core/transaction-query.ts` | `summarizeTransactions` 的支出合计 |
| `src/pages/Transactions.tsx` | 汇总行（见下）；「支出」筛选也要排除转账 |
| `src/pages/Dashboard.tsx` | 当月卡片视图的支出统计 |

**明细页汇总行的处理**：如果汇总只显示「支出 X」，而列表里混着转账，用户会疑惑为什么加不起来。
因此汇总行改为显示三项：**支出 / 收入 / 转账**，转账单独列示但不并入支出。

**筛选语义**：「支出」筛选项只显示真实消费（不含转账）；转账通过分类筛选查看。

**实现建议**：抽一个 `isConsumption(txn)` 判定（`amount > 0 && category !== '转账'`）放进
`src/core/transaction-query.ts`，全站统一调用，避免各处散落字符串比较。
