# 第四批：深色模式 + 删除撤销

> 状态：**已实施**（单测 276 → 321 全绿，`tsc -b` 无错，`oxlint` 0 警告，`vite build` 通过）
> 来源：第三批完成后列出的「新功能」清单，用户选定 D1 + D2
> 决策：撤销入口 = 底部 Toast（8 秒）**＋** 设置页「最近删除」列表；保留策略 = 20 批 / 30 天 / 500 笔上限

---

## D1 深色模式

### 机制

组件层零改动：全仓组件都用语义化工具类（`bg-surface` / `text-ink` / `border-line` …），
只有 3 处原始色（弹窗遮罩 `black/40`、配图遮罩 `white/20`、`black/45`），两套主题下都成立。
因此只需在 `src/index.css` 里为深色覆盖同一批 `--color-*` 令牌。

### 令牌取值（已用 WCAG 公式验算，正文 ≥4.5:1）

| 令牌 | 浅色 | 深色 | 深色下对比度（对 canvas / surface） |
|---|---|---|---|
| canvas | `#f7f8fa` | `#0f1217` | — |
| surface | `#ffffff` | `#171b22` | — |
| line | `#e8ebf0` | `#262c35` | — |
| ink | `#14181f` | `#e9edf2` | 15.96 / 14.68 |
| ink-muted | `#5b6675` | `#aab4c0` | 8.93 / 8.22 |
| ink-subtle | `#6b7280` | `#8b95a3` | 6.19 / 5.69 |
| expense | `#c92a2e` | `#f87171` | 6.17 / 6.24 |
| expense-soft | `#fef3f3` | `#2a1618` | — |
| income | `#0b7a44` | `#34d399` | 8.02 / 8.98 |
| income-soft | `#f0faf4` | `#12291f` | — |
| alert | `#b45309` | `#fbbf24` | 9.49（对 alert-soft） |
| alert-soft | `#fffbeb` | `#2a2113` | — |
| brand | `#2563eb` | `#60a5fa` | 6.18 / 6.79 |
| brand-soft | `#eef4ff` | `#16233a` | — |

注意「层级」在深色下方向相反：浅色模式 ink 最深、subtle 最浅；深色模式 ink 最亮、subtle 最暗。
测试按各自方向断言。

### 触发与持久化

- `AppSettings.themeMode: 'system' | 'light' | 'dark'`（默认 `system`），存 `pfd_settings`
- 新增 `src/theme/theme.ts`：纯函数 `resolveTheme(mode, systemPrefersDark) → 'light' | 'dark'`、`normalizeThemeMode(raw)`
- 新增 `src/theme/apply-theme.ts`：把结果写到 `document.documentElement.classList`，并在 `system` 模式下监听 `matchMedia('(prefers-color-scheme: dark)')`
- `main.tsx` 渲染前先应用一次（Web 端同步读 localStorage，避免闪白）；原生端 Preferences 异步，store 加载后再补一次
- `.dark { color-scheme: dark }`；`index.html` 的 `theme-color` 拆成 light/dark 两条 media
- 设置页新增「外观」三选一

### 图表

- `src/constants/chart-colors.ts` 增加 `DARK_CHART_COLORS`（与深色令牌同值，`bar` 用 `#818cf8`，对 surface 5.79:1）
- option 构造器改为 `buildTrendOption(data, palette)` 等，纯函数保持可 SSR 测试
- 新增 `useChartColors()`（读 settings store 的主题状态），四个图表组件传入对应调色板，切主题即重绘

### 测试

- `contrast.test.ts` 扩展：深色令牌对 canvas/surface ≥4.5:1；层级方向断言
- `chart-colors.test.ts` 扩展：深色图表色与深色令牌同值、图形色 ≥3:1
- `theme.test.ts`：`resolveTheme` 四组合、非法值回落 `system`
- `chart-options.test.ts`：深色调色板下四张图仍能 SSR 渲染且零告警

---

## D2 删除撤销 / 最近删除

### 数据

- 新增存储键 `pfd_trash`：`TrashEntry[]`
  ```ts
  interface TrashEntry {
    id: string;
    deletedAt: string;           // ISO
    reason: 'single' | 'months';
    label: string;               // 展示用，如「8 月、9 月」
    transactions: Transaction[];
    budgets?: Budget[];
    totalBudgets?: Record<string, number>;
  }
  ```
- `src/core/trash.ts` 纯函数：
  - `addTrashEntry(entries, entry, now)` → 头插并剪枝
  - `pruneTrash(entries, now)` → 保留最近 `TRASH_MAX_BATCHES`(20) 批、`TRASH_TTL_MS`(30 天) 内、且总笔数 ≤ `TRASH_MAX_TRANSACTIONS`(500)
  - `restoreTransactions(entry, existing)` → 按 id 合并，已存在的跳过（不覆盖用户后续改动）
- 封面图：删除时**不再立即删** `pfd_cover_<id>`；随快照保留，过期/清空时才真正移除

### 行为

- `deleteTransaction` / `deleteByMonths` 先写 trash 再删；按月份清理同时把预算（`removeByMonths` 的产物）一起入库
- 明细页与清理页删除后出现底部条「已删除 N 笔 · 撤销」（8 秒后自动消失，可手动关闭）
- 设置 → 数据管理新增「最近删除」：列出批次（时间、来源、笔数）、单批恢复、清空
- 「清除所有数据」连带清空 trash、全部封面键

### 测试

- `trash.test.ts`：批次上限淘汰顺序、30 天过期、500 笔上限、按 id 合并去重
- `transaction-store.test.ts`：删除后 trash 有条目、恢复后记录回库且 id 不变、封面键在删除后仍在、`deleteByMonths` 返回值不回归

---

## 验证

1. 全程 TDD：先补测试再改实现；现有 276 例保持全绿。
2. `tsc -b` 无错、`oxlint` 0 警告、`vite build` 通过。
3. dev server 冒烟：浅色/深色下 `index.html` 与关键模块均可加载。
4. 提交后更新 `README.md`（深色模式、最近删除、测试数）。

## 实施结果

- 单测 **276 → 321**（新增 45 条：深色令牌对比度 5、主题解析 9、图表深色调色板 4、回收站纯函数 12、store 回收站 7、预算恢复 3、其余为既有断言的扩展）。
- `tsc -b` 无错、`oxlint` 0 警告（113 文件）、`vite build` 通过（入口 353.00 KB / gzip 115.77）。
- dev server 冒烟：`/`、`main.tsx`、`theme/*`、`SettingsAppearance`、`UndoBar`、`core/trash`、`SettingsData`、`Cleanup`、`index.css` 全部 200 且无 transform 错误。
- 额外做了一次变异检查：把 `pruneTrash` 的过期判断改成 `false` 后「丢掉超过 30 天的批次」立即失败，还原后恢复全绿——证明这组测试真的会咬。
- 一处实现调整：`deleteTransaction` 现在返回回收站批次 id（原来返回 `void`），撤销条据此回滚；`deleteByMonths` 增加可选的 `extra`（预算快照），清理页负责把同一次清理里删掉的预算一并存进回收站。

## 明确不做

列表虚拟化、PWA、月报、支付宝账单导入、i18n、周期扣款提醒。
