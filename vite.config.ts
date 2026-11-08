import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  // 桌面端通过 file:// 加载构建页面，资源需使用相对路径。
  base: './',
  plugins: [react()],
})
