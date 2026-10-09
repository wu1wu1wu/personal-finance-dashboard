# 第六批：手记卡片、返回逻辑、年月选择器、明细页筛选瘦身

> 状态：**全部已实现**。本文件记录口径、实现位置与取舍；实测数据见文末「验证记录」。

用户提了五条意见，落在四件事上：

| 用户意见 | 处理 |
|---|---|
| ① 返回键动不动就退出软件、改主题要跳详情页 | 见 §2 返回逻辑（原生接管返回键 + 各页返回不再污染历史） |
| ② 带配图的卡片删不掉；「主题」这名字不对 | 见 §1 手记卡片（改名手记、卡片上改字/配图、✕ 一次清干净并可撤销） |
| ③ 看板上方的月份太简陋、看不出是哪年 | 见 §3 年月选择器（带年份、可翻年、三处共用） |
| ④ 可考虑把「主题」页改成明细… | 用户随后明确「大卡片是它的最大特点」，**保留大卡片墙**，底部导航本次不动 |
| ⑤ 明细页筛选条件太大 | 见 §4 筛选瘦身（保留常驻的月份/搜索，高级条件收进面板） |

---

## 1. 手记卡片（原「主题」）

一笔账单上的**一句话 + 一张图**（都可以没有，但至少有一个才算一条手记）。

- 文字上限 **80 字**（原来 40 字、"手记"这个名字下写不完整句话），卡片上最多显示 3 行
- 配图沿用原来的压缩管线（`compressImage`：最长边 300px、JPEG 0.7），单独存 `pfd_cover_<id>`
- 看板右上角切到「手记」→ 当月有话或有图的账单**按大卡片铺开**（手机一列、`sm` 两列）

**卡片交互**：

- 点卡片空白 → 进该笔详情（`/transactions?id=`）
- 点手记文字 → 进入编辑态（按用户意见**没有**单独放铅笔按钮）
- 编辑态里可加图 / 换图 / 删图；编辑时不显示 ✕，避免正在改字时手滑
- ✕ → 移出手记：文字与配图一起清，卡片立刻消失，屏幕下方留 **8 秒撤销**
- 手记被改成空、且没有配图时卡片也会消失，同样给一条撤销（`手记已清空`）
- 「取消」按钮在 `pointerdown` 上 `preventDefault`：否则失焦保存会抢在取消之前

**这次 bug 的根因**：原来「算不算手记」的判断（`theme || coverImage`）散在页面里，而 ✕ 只清 `theme`，两边口径对不上，于是带图卡片永远删不掉。现在统一到 `core/transaction-note.ts`：

- `hasNoteCard(txn)`：卡片是否陈列的唯一判断（纯空白文字不算）
- `normalizeNote(raw)`：去首尾空白 + 按 80 截断；store 的 `setTheme` 入口也统一清洗一次
- `clearedNotePatch()`：一次清空文字与配图

`clearNote(id)` 在**同一次 `set`** 里清掉两个字段（分两次写会对整个交易数组多序列化一遍，中间那一帧还会露出「文字没了、图还在」的半截状态），并顺手删掉 `pfd_cover_<id>`，不留孤儿数据。

**存储字段名沿用旧的 `theme` / `setTheme`**：改名要写数据迁移、要动备份兼容，风险大收益小；类型与 store 上都注明了「theme = 手记文字」，界面文案一律叫手记。

---

## 2. 返回逻辑

### 根因

`BridgeActivity.java`（Capacitor 8，218 行）**完全没有接管返回键**——这件事被下放给 `@capacitor/app` 插件，而本项目没装。于是系统走 `AppCompatActivity` 默认行为：直接 `finish()`。跟 WebView 里有没有历史无关，所以任何子页面、任何弹窗里按返回都退出 App。

### 三层处理

1. **原生**（`MainActivity.java`）：`OnBackPressedCallback` 里先执行 `window.__pfdHandleBack()`。返回 true（Web 层吃掉了这次返回）就什么都不做。
2. **Web 消费栈**（`core/back-stack.ts`）：后进先出的处理器栈；`Modal.tsx` 里挂一次 `useBackHandler(onClose)`，全项目所有弹窗（详情、记一笔、月份选择）就都覆盖到了。
3. **退回 WebView 历史**：没人吃这次返回时，`canGoBack()` 就 `goBack()`（SPA 的 pushState 同样计入历史），历史到底才退出 App。

`consumeBack` **故意不弹出处理器**：弹窗没关掉时，下一次返回还该找它（有单测固定这个语义）。

### 顺手修掉的三处历史污染

| 问题 | 原来 | 现在 |
|---|---|---|
| 设置子页的返回箭头 | `navigate(backTo)` 每次都再压一条父页历史 → 历史变成「设置→外观→设置」，返回键在两页之间弹 | 从父页点进来的（`location.state.from`）真回退，其余情况 `replace` 到父页（`core/nav-back.ts` + `useBackTo`） |
| 月度报告切月份 | `setSearchParams` 没带 replace → 连看 5 个月，返回键要按 5 次 | `{ replace: true }` |
| 点当前所在的导航 tab | NavLink 再压一条同路径历史 → 返回键按一次像没反应 | `NavItem` 检测到已在当前页就用 replace |

`Cleanup` 页原来的返回箭头是同一段复制代码，这次换成统一的 `PageHeader`。

**浏览器/PWA 里的语义不变**：返回仍是「回上一页」（弹窗随页面卸载关闭）。原生接管只影响 App。这是刻意的取舍——Web 上模拟"返回关弹窗"要往历史里塞假条目，而 React Router v7 的 `replaceState` 会丢掉自定义 state，跟踪容易失效。

---

## 3. 年月选择器

原来三处（看板 / 预算 / 明细）都是同一段横滑 chip 行，只写「9月」不带年份，选项来自「最近 6 个月 ∪ 有数据 ∪ 有预算 ∪ 下个月」——月份一攒多就成了一条越来越长的横条，也看不出是哪一年。

现在统一用 `MonthPicker`：

- 触发按钮直接写全 **「2026年9月 ▾」**（英文 `September 2026`）
- 点开是面板（复用 `Modal`，顺带白拿返回键处理）：`‹ 2026 年 ›` + **12 个月网格**
- 有记录的月份打一个小圆点；没有记录的淡显但**仍可选**（可以空着月份设预算）
- 底部「回到本月」；明细页多一个「全部月份」
- 年份边界见 `yearBounds`：数据（含预算）所在年 ∪ 锚点年 ∪ 今年 ∪ 下个月所在年——往前能翻到最早一条记录那年，往后能提前给下个月（12 月时是明年）做预算，再往外禁用，避免无限翻到 1970

明细页的月份筛选（`''` = 全部月份）也换成同一个组件，所以 `utils/date.ts` 的 `buildMonthOptions` 没有调用方了，连同它的 5 条单测一起删掉。

---

## 4. 明细页筛选瘦身

原来方向分段控件 + 排序下拉 + 搜索框 + 金额区间四块常驻，占掉近半屏。

现在：

```
明细                                      共 128 笔
[2026年9月 ▾]  [🔍 搜索交易对方或商品说明…]  [筛选 · 2]
└ 收起时只剩这一行；下面这块默认不出现
   ┌ 更多筛选条件 ─────────────────────────────┐
   │ [全部|支出|收入]  [排序 ▾]                 │
   │ [最小金额] 至 [最大金额]              ✕    │
   │ 方向、排序与金额区间        清除这些条件    │
   └───────────────────────────────────────────┘
```

- 分类 / 待确认 / 月份 / 关键词**不算**高级条件：它们各自有常驻入口，收起面板也不影响（`hasAdvancedFilters`）
- 深链或返回带进来时**自动展开**（`?direction=income&min=100` 不会把生效的条件藏起来）
- 「筛选」按钮上的角标是当前生效条件个数（`countActiveFilters`，分类与待确认算同一项）
- 「清除这些条件」会同时清掉本地金额输入框的 state——否则那个 250ms 的防抖回写会把刚清掉的条件又塞回 URL

---

## 5. 实现位置

- 手记：`core/transaction-note.ts`、`stores/transaction-store.ts`（`clearNote` + `setTheme` 清洗）、`components/transactions/TransactionCard.tsx`、`pages/Dashboard.tsx`、`components/transactions/TransactionDetailModal.tsx`
- 返回：`android/app/src/main/java/com/pfd/ledger/MainActivity.java`、`core/back-stack.ts`（+ 测试）、`core/nav-back.ts`（+ 测试）、`hooks/useBackHandler.ts`、`hooks/useBackTo.ts`、`components/ui/Modal.tsx`、`components/ui/PageHeader.tsx`、`components/ui/NavItem.tsx`、`main.tsx`（挂 `window.__pfdHandleBack`）、`vite-env.d.ts`
- 年月选择器：`core/month-picker.ts`（+ 测试）、`components/ui/MonthPicker.tsx`、`pages/{Dashboard,Budget,Transactions}.tsx`
- 筛选：`core/transaction-filters.ts`（`hasAdvancedFilters` / `countActiveFilters` + 测试）、`pages/Transactions.tsx`
- 文案：`i18n/messages/{zh-CN,en}/{common,transactions,dashboard,budget,settings}.ts`

---

## 6. 取舍

- **保留手记大卡片**：不改成明细式行，也不动底部导航（用户后续再定）。
- **不做手记卡片样式/皮肤模板**：README「已知限制」里已从"主题商店/皮肤切换"改写为"手记没有样式模板"，留给后续。
- **没有铅笔按钮**：编辑入口只有"点手记文字"，按用户意见省掉。
- **撤销只活 8 秒、只在当前页面内存里**：它不是回收站条目（交易本身没被删），刷新就没了；好处是不用为它加一份持久化结构。
- **返回栈由各层自己注销**：`consumeBack` 不弹出处理器，靠弹窗卸载时清理；好处是"弹窗还开着"时返回键仍归它管。
- **浏览器不模拟"返回关弹窗"**：见 §2 末尾。
- **`buildMonthOptions` 直接删掉**：年月选择器不再需要预生成选项列表，留着就是死代码。

---

## 7. 上线后发现的崩溃：EChart 的 CJS 默认导入

用户装上 APK 后一打开就是「页面出错了 / Minified React error #130」。定位与修复过程值得记下来：

- **解码错误**：`formatProdErrorMessage(130, typeof type, "")` 对应 react.dev/errors/130 → 「Element type is invalid ... but got: **object**」——某个 JSX 标签拿到的是对象，不是组件。
- **复现**：单测与「空数据」浏览器都正常。真正的复现办法是给浏览器灌一份真实数据：往 localStorage 写入 131 笔交易后再打开页面——**空数据时看板走的是空状态分支，图表根本没渲染过**，所以这个 bug 在空数据下永远看不见。
- **定位**：非压缩的 dev 版控制台直接点名 ——
  `Check the render method of 'EChart'. The above error occurred in the <EChart> component.`
- **根因**：`EChart.tsx` 里 `import ReactEChartsCore from 'echarts-for-react/lib/core'`。`lib/core.js` 是 CJS（`exports.default = 组件`），打包器给 `default` 的是那个**模块对象**本身。之前用包根入口 `echarts-for-react` 没事，是因为 `package.json` 的 `module` 字段指向 `esm/index.js`。
- **修法**：改从 ESM 那份导入 `echarts-for-react/esm/core`（同一份代码，包里有 `esm/core.d.ts`，类型也能解析）。

**教训**：这类「只有真渲染才炸」的问题，`tsc` / `oxlint` / 单测 / 空数据冒烟全都拦不住。以后凡是改了图表、CJS 依赖或拆包策略，都按这条流程验一次（本机有 Edge/Chrome 即可）：构建 → 预览 → 同一个浏览器 profile 先灌数据再打开 → 检查 DOM 里有没有「页面出错」、控制台有没有 JS 报错。

---

## 8. 已知缺口

- **卡片交互与月份面板的交互没有单测**：项目单测是 node 环境、无 jsdom，只有纯逻辑（`transaction-note`、`back-stack`、`nav-back`、`month-picker`、`transaction-filters`）进得了测试；组件交互靠 `tsc` + `oxlint` + 构建 + 浏览器手测。
- **安卓返回键需要重新出包才能验证**：`MainActivity` 的改动要 Gradle 构建后装机；本机没有真机/模拟器，只能保证编译通过 + 逻辑单测通过。
- **配图仍是 base64 存在本地**，图片多了占用可观（原有已知限制，未变）。

---

## 9. 验证记录

- 单测：**557 → 589**（42 个文件）。新增：`back-stack` 8、`nav-back` 4、`month-picker` 16、`transaction-filters` +9（含 `hasAdvancedFilters` / `countActiveFilters`）；删除 `buildMonthOptions` 用例 5 条。崩溃修复后复跑仍是 42 文件 / 589 测试全绿
- `tsc -b --force`：无输出，exit 0
- `oxlint`：0 warning / 0 error（193 文件）
- `vite build`：成功；`dist/sw.js` 仍是经典脚本（`node --check` 通过、无 import/export/document）
- **真实浏览器 + 真实数据**（headless Edge，localStorage 灌入 131 笔交易）：`/`、`/transactions`、`/transactions?direction=income&min=100`、`/budget`、`/report`、`/report?month=2026-09`、`/settings`、`/cleanup` 全部渲染正常，DOM 里没有「页面出错」，控制台除 PWA 安装提示外无 JS 报错；修复前同一套复现稳定触发 #130
- 开发服务器冒烟：`/`、`MonthPicker.tsx`、`Transactions.tsx`、`Budget.tsx`、`useBackTo.ts`、`back-stack.ts`、`main.tsx` 全部 200；dev 模式下带数据渲染同样已正常
- 变异检查（证明守卫真的会响，均已还原并复跑全绿）：
  1. `hasNoteCard` 只看 `theme` → 「只有配图也算一条」失败
  2. `clearNote` 去掉 `saveCover(id,'')` → 「独立的图片键也一起删」失败
  3. `resolveBackAction` 去掉 pop 分支 → 「来源是父页时真回退」失败
  4. `yearBounds` 忽略数据年份 → 3 条用例失败
- APK：`cap sync android` + Gradle `assembleDebug` 成功，产物 `android/app/build/outputs/apk/debug/app-debug.apk`
