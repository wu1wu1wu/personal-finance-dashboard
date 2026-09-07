# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

---

## 常用命令

| 命令 | 说明 |
|------|------|
| `npm run dev` | 启动开发服务器（端口 3000，自动打开浏览器） |
| `npm run build` | TypeScript 类型检查 + 生产构建，输出到 `dist/` |
| `npm run test` | 运行 Vitest 单测（`src/**/*.test.ts`） |
| `npm run test:watch` | 监听模式运行单测 |
| `npm run lint` | 运行 oxlint 代码检查 |
| `npm run preview` | 本地预览生产构建 |

单测使用 **Vitest** 4（node 环境），覆盖 `core/` 与 `utils/` 纯函数；测试文件同样受 `tsc -b` 类型检查约束。

---

## 技术栈

- **React** 19 + **TypeScript** 6（strict 模式）
- **Vite** 8（构建工具），开发服务器端口 3000
- **Zustand** 5（状态管理，手动持久化到 localStorage）
- **Tailwind CSS** 4（通过 `@tailwindcss/vite` 插件）
- **ECharts** 6（通过 `echarts-for-react` 封装），用于所有图表
- **react-router-dom** v7（客户端路由，BrowserRouter）
- **oxlint**（不是 ESLint），配置在 `.oxlintrc.json`
- **Vitest** 4（单元测试，配置在 `vitest.config.ts`）
- **papaparse** v5 + **xlsx** 用于解析微信账单 CSV/Excel 文件
- **uuid** v14（v5 命名空间，用于生成确定性交易 ID 以实现去重）
- **Capacitor** 8（打包为安卓 App）+ **@capacitor/preferences**（原生本地存储，底层 SharedPreferences）

路径别名：`@/` 映射到 `src/`（在 `vite.config.ts` 和 `tsconfig.app.json` 中配置）。

没有第三方 UI 组件库——所有 UI（按钮、输入框、卡片、进度条、下拉菜单、弹窗）均使用 Tailwind 工具类手写实现。

---

## 架构概览

这是一个**纯客户端 React SPA**，没有后端。所有数据本地持久化（键名前缀为 `pfd_`）：Web 端用 `localStorage`，安卓 App 端用 Capacitor `Preferences`（底层 SharedPreferences）。

### 目录分层

```
src/
  core/          # 纯逻辑引擎（无 React 依赖）
  stores/        # Zustand 状态管理（3 个 store）
  components/    # 展示组件，按功能分组
  pages/         # 顶层路由页面
  types/         # TypeScript 类型、接口和常量
  utils/         # 工具函数（日期、格式化、ID 生成）
  storage/       # 本地存储抽象层（localStorage / Preferences）
  hooks/         # 自定义 hooks（当前为空）
  services/      # 预留的 API 服务层（当前为空）
```

### 核心数据流

```
微信账单 CSV/XLSX → csv-parser.ts 解析 → classifier.ts 关键词规则匹配
→ 自动分类 → Transaction[] → stores 持久化到 localStorage
```

### 路由（`App.tsx`）

4 个平级路由，无嵌套布局：

| 路径 | 页面 | 说明 |
|------|------|------|
| `/` | Dashboard | 看板：KPI 卡片、趋势图、饼图、柱状图、周期交易 |
| `/transactions` | Transactions | 明细：上传区 + 交易列表（前 50 条），可按分类筛选 |
| `/budget` | Budget | 预算：进度条概览 + 编辑器面板 |
| `/settings` | Settings | 设置：上传、分类规则、数据统计、备份/恢复、清空数据 |

看板的饼图支持点击钻取到 `/transactions?category=xxx`。

### 状态管理（Zustand）

三个 store，均采用相同模式：
- `transaction-store.ts` — `Transaction[]` 的增删改查、筛选、导入状态
- `classification-store.ts` — 自定义分类规则、反馈学习、反馈自动升级为规则
- `budget-store.ts` — 各类别 `Budget[]` 及总月度预算的增删改查

每个 store 的模式：
1. `loaded` 布尔标志 + `loadFromStorage()` 异步方法，首次访问时从 localStorage 懒加载
2. 每次变更后立即调用 `persist()` 同步写回 localStorage
3. 无中间件，无 optimistic update

### 分类系统

- **内置规则**（[constants/rules.ts](src/constants/rules.ts)）：8 个类别的关键词→类别映射
- **自定义规则**：用户可添加/编辑/删除关键词规则，优先级高于内置规则
- **反馈学习**：用户在交易列表手动更改分类时会记录反馈，同类反馈累积后自动升级为规则
- 9 个类别：餐饮美食、交通出行、购物消费、休闲娱乐、居住生活、医疗健康、教育学习、其他、待确认

### StorageAdapter 抽象

[storage/StorageAdapter.ts](src/storage/StorageAdapter.ts) 定义了 `StorageAdapter` 接口（`get`/`set`/`remove`/`clear`/`keys`），有两个实现：`LocalStorageAdapter`（Web 端）和 `CapacitorPreferencesAdapter`（安卓 App 端，底层 SharedPreferences）。`storage` 单例通过 `Capacitor.isNativePlatform()` 自动选择。接口设计允许未来替换为 SQLite 或 API 适配器。

### 关键细节

- **交易 ID 去重**：通过 UUID v5 确定性生成（基于交易单号等内容哈希），防止重复导入
- **日期处理**：以 `yyyy-MM` 格式的月份键为索引；`utils/date.ts` 提供月份边界、日期范围等函数
- **金额约定**：正数 = 支出，负数 = 收入
- **数据脱敏**：`core/data-masker.ts` 可对银行卡号、姓名、手机号进行脱敏处理
- **部署**：Nginx 静态站点（`nginx.conf`），也支持 Vercel（`vercel.json`）

### 构建安卓 APK

项目已接入 Capacitor 8（`capacitor.config.ts`，appId `com.pfd.ledger`，appName `记账`，webDir `dist`）。出 APK 流程：

1. `npm run build` — 产出 web 资源到 `dist/`
2. `npx cap sync android` — 同步 web 资源 + 配置到 `android/`
3. 编译 APK（**需 JDK 21**（Capacitor 8 要求，不是 17）+ Android SDK）：
   - 先 `export JAVA_HOME="E:/Android/jdk21/jdk-21.0.12.1+1"` 指向 JDK 21
   - 命令行：`cd android && sh gradlew assembleDebug`（Windows Git Bash）
   - 产物：`android/app/build/outputs/apk/debug/app-debug.apk`
   - 或用 `npx cap open android` 在 Android Studio 打开后点 Run

**本机环境（已配好，2026-08-30）**：
- Android SDK：`E:/Android/sdk`（`android/local.properties` 里 `sdk.dir=E:/Android/sdk`；已装 platforms;android-36、build-tools 35.0.0/36.0.0）
- 完整 JDK 21：`E:/Android/jdk21/jdk-21.0.12.1+1`
- 国内镜像：`gradle-wrapper.properties` 已改腾讯云源；`~/.gradle/init.d/china-mirrors.gradle` 配置了阿里云 Maven 镜像

首次构建 Gradle 会联网下载依赖，需配置好 Android SDK（`local.properties` 里的 `sdk.dir`）。
