/// <reference types="vite/client" />

/**
 * 构建号（vite.config.ts 用 define 注入）。
 * 记账 App 里没别的用途：Service Worker 拿它当缓存版本与更新检测的标识，
 * 每次构建都会变，所以新版本一部署旧缓存就会被清掉。
 */
declare const __BUILD_ID__: string;
