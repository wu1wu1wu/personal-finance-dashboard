import { defineConfig } from 'vitest/config'
import path from 'path'

// 测试配置：core/utils 为纯函数，运行在 node 环境（无需 jsdom）
export default defineConfig({
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
})
