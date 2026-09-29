# 加固方案：账目正确性 + 数据隐私安全 + 刚需体验

> 状态：已确认，待实施
> 来源：2026-09 全量代码审查（数据层与 core 引擎 / 自动记账原生链路 / UI 与性能 三路只读审查 + 逐条复核）
> 范围：A′ 账目正确性、A″ 数据与隐私安全、B 刚需体验。性能类（周期检测复杂度、bundle 拆包、触控目标、对比度）与筛选状态进 URL 留待下一批。

原则：**不猜就没有分类；宁可留在待确认，也不要静默填错。** 本批所有修法都以"宁可提示用户，也不静默出错"为准。

---

## A′ 账目正确性

### A′1 「收款方」被判成收入（致命）

**现象**：`INCOME_KEYWORDS` 含 `收款`，且 `isIncome` 判定在 `isExpense` 之前短路。

**证据**：`src/core/transaction-capture.ts:39`、`:219-227`

```ts
const INCOME_KEYWORDS = ['收入','收款','到账','入账','红包','退款','转入'];
const isIncome = INCOME_KEYWORDS.some((k) => cleaned.includes(k));
...
amount: isIncome ? -amount : amount,
```

「付款成功 ¥23.00 收款方：XX」含子串「收款」→ 记成收入。现有测试
`src/core/transaction-capture.test.ts:41`（「收款到账」）固化了这个错误假设。

**修法**：
1. 方向判定改为**支出优先**：先判支出关键词，两者都命中时按支出。
2. `收款` 收紧为「已收款 / 收款成功 / 收款到账」；对「收款方 / 收款人 / 付款给」加负向排除（这些词只说明对方是谁，不说明方向）。
3. 补回归用例：「付款成功 ¥23.00 收款方：XX便利店」必须是支出 +23。

### A′2 被回填过的记录重复导入会重复入账

**现象**：回填时保留占位 id、丢弃账单自身的确定性 id，并把 `origin` 改成 `import`；于是 id 去重失效、`isPlaceholder` 也不再成立。

**证据**：`src/core/transaction-reconcile.ts:124-134`、`:54-56`；`src/components/transactions/UploadZone.tsx:80-84`

**注意区分**：未配上占位的账单记录保留了自身 id，重复导入同一文件仍能去重；中招的只有「被回填过」的那批。

**修法**：
1. `Transaction` 新增 `billId?: string`（账单原生 uuid），回填时写入；占位 id 继续保留（封面、标签不丢）。
2. 导入去重条件从「id 命中」扩为「id ∪ billId ∪ transactionNo 命中」。
3. 老数据迁移：`billId` 缺省为空串，不参与匹配。
4. 补用例：回填一次 → 再导入同一账单 → 不得多出记录。

### A′3 带分类的自定义规则的记录永远不回填

**现象**：规则给了分类就写 `categorySource: 'manual'`，而回填白名单排除 `manual`。

**证据**：`src/hooks/useAutoLedger.ts:70-75`、`src/core/transaction-reconcile.ts:54-56`

**修法**：
1. `categorySource` 增加枚举值 `'rule'`：规则指定的分类不再冒充用户手动分类。
2. 新增 `userEdited?: boolean`（用户是否真的动过这条记录）。
3. 回填白名单改为：`origin === 'auto' && !userEdited && categorySource !== 'manual'`。
4. 老数据迁移：`origin === 'auto' && categorySource === 'manual'` 分不清来源，保守视为 `userEdited = true`（不回填，不覆盖用户数据）。
5. `CategoryTag` 增加「规则」标记；`TransactionDetailModal` 的来源文案同步。

### A′4 csv 解析三处静默错误

**证据**：`src/core/csv-parser.ts:213`、`:266`、`:270-272`、`:285-288`

1. **表头校验 `&&` 应为 `||`**：只命中一个关键表头时校验通过，随后每行都被跳过 → 返回 0 条且 `errors` 为空。
   修法：改 `||`；返回空结果时补一条明确 error。
2. **「收/支」第三种取值被当成支出**：`isIncome ? -|a| : +|a|` 让「不计收支」变成正数，而 `isConsumption` 只看 `amount > 0`。
   修法：新增「不计收支」分支，标记为中性（既不进支出也不进收入统计），分类直接给「转账」并在 UI 上可辨认。
3. **`informativeTypes` 精确匹配**：微信实际取值多为「零钱提现」「信用卡还款」这类复合词，`includes('提现')` 为 false → 类型串进不了描述 → 转账关键词命中不了 → 按支出统计。
   修法：改为包含匹配（`some((t) => wechatType.includes(t))`）。
   **待确认**：微信账单「收/支」与「交易类型」的完整取值集合需用真实导出账单核对；核对前按防御性解析处理。

---

## A″ 数据与隐私安全

### A″1 persist 静默失败

**证据**：`src/storage/StorageAdapter.ts:35-42`（超限抛错）；`src/stores/*.ts` 全部 29 处 `get().persist();` 既不 `await` 也不 `.catch()`（transaction-store 13 处、budget-store、classification-store、capture-rule-store）。

**后果**：内存已变、磁盘没写，界面显示"已保存"，刷新回退且此后写入持续失败；单条约 300-350 字符，约 1.5 万条或数百张封面图即触顶。

**修法**：
1. 四个 store 增加 `persistError: string | null`。
2. `persist()` 内部 try/catch，写失败时置 `persistError`；成功时清空。
3. App 顶部常驻告警条（`role="alert"`），附「导出备份」入口。
4. `persist` 加 200ms 防抖合并；跨 store 的重复写合并到一轮。
5. `Dashboard.handleUnmarkPeriodic` 的循环逐条 `togglePeriodic` 改批量 action `togglePeriodicBatch(ids)`。

### A″2 封面图 base64 撑爆配额

**证据**：`src/utils/image.ts:5-6`（300px / JPEG 0.7，约 20-40KB/张）→ `Transaction.coverImage` → 全量写单一 key `pfd_transactions`。

**修法**：封面图独立键 `pfd_cover_<id>`，store 的 `loadFromStorage` 合并回 `coverImage`、`persist` 前剥离，**UI 组件零改动**；老数据首次加载时自动迁移（写入独立键并从主数组移除）。

**约束**：`id` 必须保持稳定（回填保留占位 id 的既有约定不变），否则封面会"串图"。

### A″3 恢复备份无校验、无确认、不可回滚

**证据**：`src/pages/SettingsData.tsx:64-96`

**修法**：
1. 恢复前自动快照当前全部 `pfd_` 键到 `pfd_snapshot_<ts>`，保留最近 3 份。
2. 确认弹窗（列明将覆盖的键与记录数）。
3. 校验：`_meta.version`、key 白名单（仅 `pfd_` 前缀）、数组结构、元素关键字段（`id` / `transactionTime` / `amount`）。
4. 逐键写入，任一键失败回滚已写键。

### A″4 导出备份未脱敏 + 无交易时禁用

**证据**：`src/pages/SettingsData.tsx:31-62`（原样 `JSON.stringify` 所有 `pfd_` 键）、`:155`（`disabled={transactions.length === 0}`）；`maskTransactions` 全项目只在导入时用过一次。

**修法**：
1. 导出提供「脱敏导出」（默认）与「完整导出」两个动作，并在界面注明差异。
2. `maskTransaction` 扩展覆盖 `description`（含自动捕获的短信/通知原文）。
3. 取消「无交易不可导出」限制。

### A″5 清除数据不彻底 / 原生队列回灌

**证据**：`src/pages/SettingsData.tsx:98-107`；原生队列在另一组 SharedPreferences（`AutoLedgerPlugin.java:40-41`）；`src/hooks/useAutoLedger.ts:118` 启动即重放队列。

**修法**：
1. 原生插件新增 `clearAllCaptures()`，一并清 QUEUE / SEEN / DEBUG。
2. `handleClearAll` 调用它，确保"清空后数据不会复活"。
3. 确认弹窗逐项列明删除范围（交易、分类规则与反馈、预算、自动记账规则与设置、捕获队列原文）。

### A″6 隐私面收口

1. `android:allowBackup="false"`，并补 `dataExtractionRules` 排除 CapacitorStorage 与 autoledger 三组 prefs。
2. **脱敏口径（已定）**：只对银行卡号、手机号、长数字、交易单号生效；**姓名不做自动脱敏**（避免"张三丰饺子店"→"张**饺子店"）。`maskName` 保留但不在主链路调用；README 与关于页同步删除"姓名"表述。
3. 落地真正的 settings store（`pfd_settings`：脱敏开关 + 默认分类），替代当前从未被读写的 `AppSettings`；或在实施中确认无需求后删除死类型——二选一，实施时以"开关是否真的有用"为准，不做两套。

### A″7 白屏兜底

新增 `ErrorBoundary`（含「导出备份」「重新加载」按钮），在 `main.tsx` 包裹 App；路由补 `path="*"` 重定向到看板。

---

## B 刚需体验

| 项 | 修法 | 涉及 |
|---|---|---|
| B1 编辑单笔交易 | store 新增 `updateTransaction(id, patch)`，可改金额/时间/对方/描述/主题；编辑后置 `userEdited = true`（避免被回填覆盖）；**id 不重算**，保持去重体系稳定 | `transaction-store.ts`、`TransactionDetailModal.tsx` |
| B2 金额区间筛选 | `queryTransactions` 支持 `minAmount` / `maxAmount`；明细页加两个输入框；顺带清理 `FilterOptions` 与 `getFiltered` 的重复口径 | `transaction-query.ts`、`Transactions.tsx`、`transaction-store.ts` |
| B3 看板「最近交易」 | 点行进该笔详情（`?id=`），与主题卡片一致 | `Dashboard.tsx:281` |
| B4 默认日期时区 | 新增 `getTodayLocal()`，替换 `toISOString().substring(0,10)` | `utils/date.ts`、`AddTransactionModal.tsx:30` |
| B5 月份导航统一 | 抽 `buildMonthOptions(...)`：最近 6 个月 ∪ 有数据的月份 ∪ 有预算的月份 ∪ 未来 1 个月，倒序展示并滚动到选中项 | `utils/date.ts`、`Dashboard.tsx`、`Budget.tsx` |
| B6 桌面端操作条对齐 | 底部固定操作条补 `md:bottom-4` | `Cleanup.tsx:162`、`Transactions.tsx:559` |

---

## 验证方式

1. 每条修法先写/改单测再改实现（含：收款方方向、二次导入不重复、规则分类可回填、表头缺一报错、不计收支不进支出、复合交易类型、persist 失败可见、封面迁移、备份校验与回滚、月份选项、金额筛选、编辑后 id 稳定）。
2. 现有 162 例保持全绿，`npm run build` 通过。
3. 真机验证：出一次 debug APK，确认自动记账方向、回填与二次导入、清除数据后不复灌。

## 已知待确认

- 微信账单「收/支」与「交易类型」的完整取值集合（影响 A′4-2 / A′4-3 的边界）。
- Capacitor WebView 上 `a.download` + blob 的落盘能力（影响 A″4 导出在真机的表现）。
- `requestRebind`、厂商自启动页跳转在国产 ROM 上的实际效果（不在本批范围）。
