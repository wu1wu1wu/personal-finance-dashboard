/// <reference types="vite/client" />

/**
 * 构建号（vite.config.ts 用 define 注入）。
 * 记账 App 里没别的用途：Service Worker 拿它当缓存版本与更新检测的标识，
 * 每次构建都会变，所以新版本一部署旧缓存就会被清掉。
 */
declare const __BUILD_ID__: string;

/**
 * 安卓返回键的 Web 层入口（main.tsx 里挂上）。
 * MainActivity 按下返回键时执行它：返回 true 表示 Web 层已经处理
 * （关掉最上面的弹窗/抽屉），原生就什么都不做；返回 false 时原生
 * 才退回 WebView 历史，历史到底再退出 App。
 */
interface Window {
  __pfdHandleBack?: () => boolean;
}
