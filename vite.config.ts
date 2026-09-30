import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import path from 'path'

/** 每次构建都不同：Service Worker 拿它当缓存版本，也是「发现新版本」的判定依据 */
const BUILD_ID = Date.now().toString(36)

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  define: {
    __BUILD_ID__: JSON.stringify(BUILD_ID),
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  build: {
    outDir: 'dist',
    sourcemap: false,
    // 模块预加载 polyfill 会往入口 chunk 里塞一段 DOM 代码；
    // sw.js 是入口之一，塞进去会让 Service Worker 直接报错。
    modulePreload: { polyfill: false },
    rollupOptions: {
      input: {
        // 主页与 Service Worker 两个入口：sw.ts 会打成 dist/sw.js
        main: path.resolve(__dirname, 'index.html'),
        sw: path.resolve(__dirname, 'src/pwa/sw.ts'),
      },
      output: {
        // Service Worker 必须落在根目录（作用域才是整个站点），且文件名固定
        entryFileNames: (chunk) => (chunk.name === 'sw' ? 'sw.js' : 'assets/[name]-[hash].js'),
        chunkFileNames: 'assets/[name]-[hash].js',
        assetFileNames: 'assets/[name]-[hash][extname]',
      },
    },
  },
  server: {
    port: 3000,
    open: true,
  },
})
