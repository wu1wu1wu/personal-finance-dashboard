# 第五批：支付宝导入、月度报告、周期扣款提醒、列表虚拟化、PWA 与界面语言

> 状态：**已实现**。本文件记录设计口径、实现位置与取舍；实测数据见文末「验证记录」。

前四批分别做了自动分类、账目正确性与隐私安全、性能与无障碍、深色模式与删除撤销。
这一批把 README「已知限制」里剩下的六项一次做完：

| 功能 | 一句话 |
|---|---|
| 支付宝账单导入 | 微信之外再认一家账单格式，交易关闭/等待付款不入账 |
| 月度报告 | 新页面 `/report`：环比、分类 TOP5、每日节奏、要点文字版可复制 |
| 周期扣款提醒 | 在周期识别之上判断「该扣没扣」「涨价了」，可在看板上忽略某个商户 |
| 列表虚拟化 | 明细页只渲染视口附近的行，上万条不卡 |
| PWA | 可安装到桌面、离线打开、发新版有提示 |
| 界面语言 | 中文 / English 双语，覆盖全部界面文案（含图表与读屏文案） |

---

## 1. 支付宝账单导入

### 为什么要单独认格式

支付宝和微信导出的 CSV 列名完全不同，而且**表头位置、表尾结构、方向列的写法都不一样**：

| | 微信 | 支付宝 |
|---|---|---|
| 表头前的行 | 16 行元信息 | 4 行元信息 |
| 时间列 | `交易时间` | `交易创建时间`（部分导出为空，要用 `付款时间`） |
| 单号列 | `交易单号` | `交易号` |
| 方向列 | `收/支` = 支出 / 收入 / `/` | `收/支` = 支出 / 收入 / **不计收支**，老版本没有这一列（用 `资金状态` 推断） |
| 表尾 | 无 | 几行统计（`共 N 笔记录`、`已收入:0.00元`） |
| 「钱没动」的状态 | 少 | `交易关闭`、`等待付款` |

### 口径

- **识别**：`detectBillFormat(headers)` 按标记词打分（微信 4 个、支付宝 6 个），得分高者胜，都认不出返回 `unknown`。
  微信的「交易单号」里不含「交易号」，支付宝的「交易创建时间」里不含「交易时间」，两套标记不会互相误判。
- **表头定位**：只在前 30 行里找，且必须「认得出格式 **且** 关键列齐全」才算真表头——
  元信息里也可能出现「交易单号」这种词（例如「常见问题：如何查询交易单号」），
  只凭标记词会把元信息行当表头，进而把整个文件判成 0 条。
- **关键列缺失必须报错**：认得出是哪家账单但缺列时，返回明确错误（告诉用户缺什么），不静默返回 0 条。
- **不计收支不算支出**：`不计收支` 与微信的 `/` 一样归 `transactionType='其他'`，由 `isConsumption()` 排除在支出统计外。
- **交易关闭 / 等待付款不入账**：钱没动，导进来就是凭空多出的支出；跳过的条数在导入结果里单独显示。
- **表尾统计行不算错误**：Papa 会为它们报「字段数不足」；只对「本该是数据行」的行报错，表尾告警一律吞掉。
- **描述合并**：`类型` 含「转账 / 充值 / 提现 / 还款 / 退款 / 余额宝」这类词时并入 `description`，否则分类器认不出资金搬运。
- **去重口径不变**：仍然按 `交易号/交易单号 + 时间 + 金额` 生成确定性 id，重复导入不会重复记账。

### 实现位置

- `src/core/bill-format.ts`：格式识别、两家的列名映射、方向判定、「钱没动」判定、描述合并（纯判断，有独立测试）
- `src/core/csv-parser.ts`：`parseBillFile()` 统一入口，CSV 与 XLSX 两条路都先识别格式再映射
- `src/components/transactions/UploadZone.tsx`：结果里显示识别出的账单来源与跳过条数
- `src/pages/SettingsImport.tsx`：两家账单「从哪里导出」的路径指引（支付宝导出的是压缩包，需先解压）

### 取舍

- **不直接读 ZIP**：支付宝的「开具交易流水证明」给的是压缩包，需要用户先解压。为此引入一个 zip 依赖不划算，改成在界面上写清楚。
- **不按 `交易状态` 过滤微信账单**：微信里「已全额退款」这类记录牵涉退款与收入的对应关系，改动风险大于收益，这一批只处理支付宝明确「钱没动」的状态。
- **老版本支付宝导出的列名靠 `WECHAT_FIELD_MAP`/`ALIPAY_FIELD_MAP` 的两处模糊匹配兜底**，没有真实老文件可验，属于未验证路径。

---

## 2. 月度报告

新页面 `/report`（从看板上的入口卡片进，`?month=yyyy-MM` 可深链）。

### 页面内容

1. **收支总览**：支出（大字）+ 收入 / 结余 / 日均 / 笔数，前三项带环比
2. **本月要点**：最多 7 条文字结论（见下）
3. **分类 TOP5**：金额条 + 占比，点「在明细里查看」跳到已带月份筛选的明细页
4. **每日支出**：柱状图（带日均参考线）
5. **最大一笔 / 周期扣款 / 待确认 / 预算执行** 四张小卡

### 要点的口径（`src/components/report/report-insights.ts`）

要点**不产出字符串**，只产出「文案 key + 参数」，所以中英文走同一套判断逻辑，测试也不用跟着文案改：

- 支出环比：`|变化| < 1%` 说「持平」；上月为 0 时说「没有可比数据」，不硬编一个 100%
- 日均：只在有支出且已过天数 > 0 时说
- 分类 TOP1、最大一笔（没有商户名时退回商品说明，不出现空名字）
- 周期扣款合计、待确认条数
- 预算：只在 ≥80%（接近）或 ≥100%（超支）时占一行，正常情况不打扰

### 实现位置

- `src/core/report-engine.ts`：`buildMonthlyReport()`（纯函数，36 条测试）
- `src/components/report/report-insights.ts`：要点生成（纯函数，12 条测试）
- `src/pages/Report.tsx`：页面
- `src/core/virtual-window.ts` 无关；`src/utils/date.ts` 新增 `shiftMonthKey()` 用于上/下月切换

### 取舍

- **环比的 `budget.percentage` 沿用预算页口径（比例 0–1 而非百分数）**，页面里自己 ×100，避免两处口径不一致。
- **报告只读不写**：不改分类、不改预算，所有「去处理」都是跳转到对应页面。
- **文字版复制**用 `navigator.clipboard`，在非 HTTPS 或没有权限时静默失败（不做误导性的「已复制」提示）。

---

## 3. 周期扣款提醒

### 为什么要单独做

`periodic-engine` 只能识别「这个商户像订阅」，回答不了用户真正关心的两件事：**下一次什么时候扣**、**是不是该扣没扣**。

### 状态判定

```
daysUntil = nextDate - today
daysUntil < 0                      → overdue（预计已扣但没记录，可能已取消/漏记）
0 <= daysUntil <= dueSoonDays(7)   → due（即将扣款）
daysUntil > dueSoonDays            → upcoming
```

- 排序：`daysUntil` 升序（最紧急在前），同天按金额降序
- `nextDate` 用「该商户最近一笔 + 一个周期」重算，**不沿用识别引擎的 `nextDate`**：
  识别引擎的分组键带金额档位，一旦调价（30 → 39 元）就会拆成两个桶，旧桶的日期早已过期，直接沿用会稳定产出假的 overdue
- `priceChanged`：`|最近一笔 - 历史均价| > max(0.5 元, 历史均价的 5%)`（严格大于）
- `monthlyTotal`（每月固定支出）：`月付 + 季付/3 + 年付/12`

### 界面

看板上的「周期扣款」卡片：每月固定支出、overdue 警示条（红色）、即将扣款列表（最多 5 条，含预计日期、周期分类、涨价提示），每条右侧一个「不再提醒」按钮。
被忽略的商户折叠在卡片底部，可以随时恢复。忽略名单存在 `pfd_recurring_ignored`，只存商户名，不影响明细与统计。

### 实现位置

- `src/core/recurring-reminder.ts`：`buildRecurringReminders()` / `summarizeRecurringReminders()` / `daysBetween()`（纯函数，43 条测试）
- `src/stores/recurring-store.ts`：忽略名单（8 条测试）
- `src/components/periodic/RecurringReminders.tsx`：卡片
- `src/pages/Dashboard.tsx`：接线

### 取舍与已知限制

- **不做系统通知/推送**：浏览器通知需要授权且只在页面打开时有效；安卓本地通知要引新依赖并做原生同步。这一批只做应用内提醒。
- **同一商户的两个不同金额订阅会串味**：例如 Apple 的 iCloud（6 元/月）与 Music（11 元/月），两条提醒都会取该商户最新一笔的金额。根源是 `previousAmount` 按「同商户全部历史」计算（这样才检测得出 >1 元的涨价）；两者不可兼得，已在引擎注释里写明。
- **识别门槛仍是 3 个月**：记录不满 3 个月的订阅不会出现在提醒里。

---

## 4. 列表虚拟化

### 之前的问题

明细页原来是「先渲染 20 条，滚到底再加载 20 条」，DOM 会随着滚动一直长下去；虽然行上有 `content-visibility: auto`，但节点数本身没有上限，几千条以后仍然会卡。

### 现在的做法

只渲染视口附近的一段，用上下内边距撑出总高度：

```
<ul ref={list.listRef} style={{ paddingTop: offsetY, paddingBottom: bottomHeight }}>
  {filtered.slice(startIndex, endIndex).map(...)}
</ul>
```

- **行高不固定**（有的行多一行「超过单笔上限」提示，批量模式下又少一行分类标签），所以不能按固定行高切片：
  1. 先用估算行高（72px）铺满滚动条；
  2. 渲染完用 `offsetHeight` 量一遍窗口内的行，写回高度表（补上 `space-y-2` 的 8px 间距，外边距不计入 offsetHeight）；
  3. 高度表变了重算前缀和与窗口，几次之内收敛。
- **窗口计算是纯函数**（`src/core/virtual-window.ts`）：高度前缀和 + 二分找可视区间，O(log n)。
  三个边界单独写了测试：行数为 0、滚过头（筛选后行数变少）时收敛到最后一屏而不是渲染空白、视口比内容高时全部渲染。
- **只有超过 60 条才虚拟化**：少于此值全渲染，省掉测量与滚动监听的复杂度。
- 原来的「加载更多」按钮、`IntersectionObserver` 哨兵、`visibleCount` 状态一并删除——不需要了。

### 实现位置

- `src/core/virtual-window.ts`：`buildOffsets()` / `findVirtualWindow()` / `computeVirtualWindow()`（纯函数，14 条测试）
- `src/hooks/useVirtualList.ts`：滚动监听（rAF 节流）、测量回填、窗口状态
- `src/pages/Transactions.tsx`：接线

### 取舍

- **整页滚动而不是给列表一个内滚动容器**：移动端底部有固定导航，再套一层内滚动会让手势变得别扭。
- **`useVirtualList` 没有单测**：仓库的 vitest 是 node 环境、只收 `src/**/*.test.ts`，没有 jsdom，hook 里的 ref/滚动/测量跑不起来。
  容易出错的窗口数学全部放在纯函数里测了；hook 本身靠 `tsc` + 生产构建 + 开发服务器冒烟验证，这一条是**已知的验证缺口**。
- **`aria-setsize` / `aria-posinset` 没加**：需要把序号透传进 `TransactionListItem`，而虚拟窗口内序号会不断变化，
  读屏播报「第 37 项，共 4821 项」的价值不如稳定的列表语义，暂时不加。

---

## 5. PWA：安装、离线与更新

### 三块内容

1. **manifest + 图标**：`public/manifest.webmanifest`、`public/icons/{icon-192,icon-512,icon-maskable-512,apple-touch-icon}.png`（品牌色 `#2563eb` 的钱包标志，maskable 版的墨迹半径 162.97px < 204.80px 安全圆）
2. **Service Worker**（`src/pwa/sw.ts` → 构建成 `dist/sw.js`）：
   - 缓存策略（`src/pwa/sw-policy.ts`，纯函数、12 条测试）：
     `/assets/*` 缓存优先（带 hash，内容永不变）；页面导航网络优先（否则用户永远看不到新版本）；
     manifest 与图标 stale-while-revalidate；跨域与非 GET 一律放行；未知路径（含 `sw.js` 自己）不进缓存
   - 缓存名带构建号（`vite.config.ts` 的 `define` 注入 `__BUILD_ID__`），activate 时清掉上一版缓存
   - 导航请求离线时回落 `index.html`，SPA 深链（`/report`）也能离线打开
3. **状态提示**（`src/components/ui/PwaStatus.tsx`）：离线横幅、新版本「立即刷新」、`beforeinstallprompt` 抓下来的「装到桌面」

### 关键实现选择

- **Service Worker 走 Vite 的第二个入口**（`rollupOptions.input`），不是手写 `public/sw.js`：
  这样 `sw.ts` 能 import 经过测试的 `sw-policy.ts`，线上跑的就是被测的那份代码，不存在两份实现的漂移。
  代价是必须盯住产物干净——已验证 `dist/sw.js` 里没有 `import`/`export`/`document`（Vite 的模块预加载 polyfill 会往入口塞 DOM 代码，
  因此关掉了 `build.modulePreload.polyfill`）。
- **原生 App 与开发环境都不注册**：Capacitor 的 WebView 本来就离线可用；开发期注册会把热更新后的旧代码缓存住。
  判定逻辑是纯函数 `shouldRegister()`，有测试。
- **`sw.js` 与 manifest 不能被长缓存**：`nginx.conf` 与 `public/vercel.json` 都加了 `no-cache`。

### 取舍与已知限制

- **没有做「离线可用一次性提示」**：离线时只有一条常驻横幅，不做弹窗。
- **没有预缓存带 hash 的 JS/CSS**：构建产物名每次都变，预缓存清单没法写死；首次访问后它们会进运行时缓存，所以「先联网用一次，之后离线可用」。
- **更新提示只在 `sw.js` 内容变化时出现**，也就是每次构建都会变（构建号进了缓存名）。用户点「立即刷新」后新版本接管并 reload。

---

## 6. 界面语言（中 / 英）

### 结构

```
src/i18n/
  locale.ts       语言类型、白名单、浏览器语言推断
  translate.ts    查表 → 复数选择 → 占位符替换 → 回落（纯函数）
  labels.ts       数据值 → 文案 key（分类 / 收支方向 / 周期）
  date.ts         按语言格式化日期与月份（Intl）
  useT.ts         React 侧：useT / useLocale / useLocaleEffect
  messages/
    zh-CN/*.ts    每个命名空间一个文件
    en/*.ts       与 zh 一一对应
```

### 几条硬约束（都由测试或类型守住）

1. **中文是唯一事实来源**：`MessageKey = keyof typeof zhCN`；英文那份标注 `Record<keyof typeof zhXxx, string>`，
   中文加了 key 却没补英文 → **tsc 直接报错**（多写一个也报错）。
2. **占位符必须一致**：`messages.test.ts` 逐 key 比对中英的 `{...}` 集合，英文漏一个参数就红。
3. **拼错的 key 编译不过**：`t()` 的参数是字面量联合类型。
4. **源码里用到的 key 必须存在**：`messages.test.ts` 扫描 `src/**/*.{ts,tsx}`（去掉注释，排除测试文件）里的
   `t('...')` / `translateIn(..., '...')` 字面量，任何一条不在字典里就失败；并额外断言「至少扫到了一批 key」，防止正则失效让这条守卫变成永远通过。
5. **命名空间不能重复 key**：命名空间列表从模块动态收集（不手写枚举，新增命名空间不会漏检），
   展开后 key 总数必须等于各命名空间之和，重复会被对象展开悄悄覆盖。
6. **复数**：key 可以带 `_one` / `_other` 变体，`t('xxx', { count })` 按 count 选；基名也允许直接传（类型层通过 `PluralBaseKey` 放开）。
7. **回落链**：当前语言缺 → 中文 → 返回 key 本身（界面上一眼看出漏了哪条），不会显示成空串或 `undefined`。
8. **分类名 / 收支方向这类「数据里就有中文」的值不做翻译**：它们是数据（历史记录、规则、账单里都是中文），
   展示时通过 `categoryLabel(locale, name)` / `transactionTypeLabel()` 映射；映射表用
   `satisfies Record<CategoryName, MessageKey>`，漏一个分类编译不过。

### 图表文案

ECharts 读不到 CSS 变量，也读不到 React hook，所以：

- `ChartLabels` 由 `useChartLabels()` 提供，`chart-options.ts` 的构造器收第三个参数（默认值从中文文案表派生，纯函数调用方不用管 i18n）
- 坐标轴数值压缩交给 `buildAxisFormatter(locale)`：中文按「万」，英文按「k」。
  **不能用「后缀字符串」表达**——英文那样会写成 `'0k'` 这种畸形后缀，25000 会显示成 30k；
  现在给的是函数，英文 25000 就是 `25k`，有 SSR 渲染断言守着
- 摘要（给读屏用的文字替代）接收 `Translate`，同样走文案表

### 已知的取舍

- **首次打开按浏览器语言猜**：`pfd_settings` 里没有 `locale` 时用 `navigator.language`（中文浏览器 → 中文，其余 → 英文），之后以用户选择为准。
- **金额单位「元」不随语言变**：`formatCurrency()` 仍然输出 `1,234.00元`。这个 App 只记人民币，
  改成符号前缀要动几十处调用点与所有快照式断言，收益不明显，**保留现状并在此声明**。
- **中文分类名在英文界面里不会消失**：分类是数据（明细列表里显示的是 `烹饪` 之类账单原文），
  只有「分类名本身」走映射表；商户名、商品名仍是账单原文。
- **没有第三种语言**：加语言只需在 `LOCALES` 与 `messages/` 下补一份，其余由类型与测试兜住。

---

## 验证记录

以下数字都是这一批收尾时实测的（本机 Node 24 / Windows）。

### 单测

```
$ node node_modules/vitest/vitest.mjs run
 Test Files  38 passed (38)
      Tests  541 passed (541)
```

321 → 541（+220）。新增测试的分布：

| 新增测试文件 | 条数 | 覆盖 |
|---|---|---|
| `src/core/bill-format.test.ts` | 24 | 两家格式识别、关键列校验、不计收支、交易关闭、描述合并 |
| `src/core/report-engine.test.ts` | 36 | 环比、日均、TOP5、日度、周期行、预算、非法月份 |
| `src/components/report/report-insights.test.ts` | 12 | 要点的触发条件与顺序 |
| `src/core/recurring-reminder.test.ts` | 43 | 三态、排序、涨价、每月折算、跨年、非法日期 |
| `src/stores/recurring-store.test.ts` | 8 | 忽略名单清洗与落盘 |
| `src/core/virtual-window.test.ts` | 14 | 前缀和、二分窗口、滚过头收敛、连续覆盖 |
| `src/pwa/sw-policy.test.ts` | 12 | 四种缓存策略的判定、可缓存响应 |
| `src/pwa/register.test.ts` | 5 | 注册条件 |
| `src/i18n/*.test.ts` | 39 | 翻译回落、复数、占位符、key 覆盖、日期格式化、分类映射 |
| `src/utils/date.test.ts`、`src/stores/settings-store.test.ts`、`src/components/dashboard/chart-options.test.ts`、`src/core/csv-parser.test.ts` | +22 | 月份位移、语言设置、图表文案与坐标轴、支付宝解析 |

### 类型与静态检查

```
$ node node_modules/typescript/bin/tsc -b --force --pretty false
（无输出，exit 0）

$ node node_modules/oxlint/bin/oxlint
Found 0 warnings and 0 errors.
Finished in 19ms on 181 files with 103 rules using 16 threads.
```

### 构建

```
$ node node_modules/vite/bin/vite.js build
✓ built in 566ms   (exit 0)
dist/assets/main-DOm00HS1.js              357.53 kB │ gzip: 116.78 kB
dist/assets/jsx-runtime-BaxRfPSH.js        88.90 kB │ gzip:  28.52 kB
dist/assets/useChartColors-B-yrfjEs.js    608.69 kB │ gzip: 206.94 kB   ← echarts
dist/assets/Dashboard-DRcxg_Za.js          30.55 kB │ gzip:   7.91 kB
dist/assets/Transactions-BPmSnAso.js       82.45 kB │ gzip:  25.94 kB   ← 进明细页才下
dist/assets/Report-CEDb9PCW.js             16.07 kB │ gzip:   4.56 kB   ← 进报告页才下
dist/assets/xlsx-YfIskiLD.js              424.71 kB │ gzip: 141.48 kB   ← 导入 .xlsx 才下
dist/sw.js                                  1.98 kB │ gzip:   0.88 kB
```

**首屏（入口 + 图表 + 看板）合计约 1085.7 KB（gzip 约 360.2 KB）**，
比第四批的 977 KB / gzip 326 KB 增加约 108.7 KB（gzip +34.2 KB，约 +10%）。
增量来自三处：中英双份文案表（约 1200 条）、报告与周期提醒两个引擎、PWA 注册与状态组件；
echarts 与 xlsx 的按需加载策略没有退化（明细/预算/设置页仍然不加载图表代码）。

后续如果要把这 34 KB 找回来，最直接的做法是**只打包当前语言的文案**（按 `locale` 动态 import 一份 messages），
代价是首屏多一次异步加载、以及少一层「英文缺 key 编译不过」的静态保证（可以改成按命名空间懒加载）。

### 产物抽查

- `node --check dist/sw.js` 通过；文件里没有 `import` / `export` / `document`（都是经典脚本要求），
  构建号已内联（本次 `pfd-assets-muo1n462`），`SKIP_WAITING` 消息处理在位
- `dist/index.html` 含 manifest 与 apple-touch-icon 引用；图标 4 个尺寸齐全，maskable 版墨迹半径 162.97px < 204.80px 安全圆

### 冒烟

`vite preview`（生产产物，端口 4174）全部 200：

```
/                                  200 text/html
/report                            200 text/html
/transactions?pending=1            200 text/html
/sw.js                             200 text/javascript
/manifest.webmanifest              200 application/manifest+json
/icons/icon-maskable-512.png       200 image/png
/favicon.svg                       200 image/svg+xml
```

`vite dev`（端口 3111）逐个请求新改动的模块，16 条全部 200 且无 transform 报错
（main / App / i18n(useT, zh-CN/transactions) / Report / Dashboard / Transactions /
RecurringReminders / useVirtualList / pwa(register, sw, sw-policy) / ErrorBoundary / PwaStatus / index.css）。

### 变异检查（证明新守卫真的会咬）

1. 把 `Report.tsx` 里的 `t('report.title')` 改成不存在的 key → `messages.test.ts` 的「源码里用到的 key 都存在」失败，
   并点名 `report.titleTYPO_FOR_MUTATION_CHECK`；还原后复跑绿。
2. 把 `en/report.ts` 的 `{percent}` 占位符删掉 → 「中英文的占位符必须一致」失败，指出该 key 的占位符集合从 `["percent"]` 变成 `[]`；还原后复跑绿。

### 已知的验证缺口（没能自动化）

- **`useVirtualList` 的滚动与测量**：仓库 vitest 是 node 环境、只收 `.test.ts`，没有 jsdom，
  hook 里的 ref / 滚动 / `offsetHeight` 跑不起来。窗口数学在纯函数里有 14 条测试，hook 本身只有类型检查 + 构建 + 模块加载冒烟。
  **首次滚动时的观感（有没有闪一下、快速滚动会不会看到空白）需要人眼确认**。
- **Service Worker 的真实离线行为与更新提示**：只能在浏览器里验证（注册、离线重开、点「立即刷新」后接管）。
  已验证的是产物干净、策略函数有测试、preview 下 MIME 与路径正确。
- **双语的视觉效果**：英文界面下文案长度变化会不会挤坏布局（尤其是按钮与图表轴标签），子代理与我都只在代码层面核对过。
- **支付宝真实账单**：解析逻辑用构造的样本覆盖了各种列组合，但没有拿真实导出文件跑过；
  真实文件里 `收/支` / `交易状态` 的取值集合可能与样本不同（不认识的取值会被当成「不计收支」，即不计入支出，属于偏保守的失败方向）。
- **`android/` 未重新构建**：本批只改了 Web 侧，`android/app/build/outputs/apk/debug/app-debug.apk`
  仍是旧产物，需要 `npm run build && npx cap sync android` 后重新出包。

