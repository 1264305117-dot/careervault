import path from "path"
import react from "@vitejs/plugin-react"
import { defineConfig } from "vite"
import { inspectAttr } from 'kimi-plugin-inspect-react'

// https://vite.dev/config/
export default defineConfig({
  base: './',
  plugins: [inspectAttr(), react()],
  build: {
    // 产物输出到 webapp/（而不是默认的 dist）：api/main.py 会把这个目录
    // 挂成站点根，一个端口同时服务前端页面与 /api —— 线上发布只需要
    // 跑这一个进程。刻意不用 dist 这个名字，发布通道会把"构建产物"
    // 目录排除在上传之外。
    outDir: 'webapp',
    emptyOutDir: true,
  },
  server: {
    // 绑 IPv4：默认 Vite 只监听 ::1，用 127.0.0.1:4173 会打不开
    host: '127.0.0.1',
    port: 4173,
    watch: {
      // SQLite 数据库文件在写库时会变化，忽略它避免开发中页面被整页刷新
      ignored: ['**/data/**', '**/.venv/**'],
    },
    proxy: {
      '/api': {
        // 用 127.0.0.1 而不是 localhost：uvicorn 默认只监听 IPv4，
        // 而 Node 解析 localhost 会优先给到 ::1，代理就会连不上（502）。
        target: 'http://127.0.0.1:8000',
        changeOrigin: true,
      },
    },
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});
