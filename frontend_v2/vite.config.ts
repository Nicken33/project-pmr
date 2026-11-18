import react from '@vitejs/plugin-react'
import { defineConfig, loadEnv } from 'vite'

// В режиме разработки запросы /api и /media проксируются на бэк (DEV_API_PROXY в .env.local),
// поэтому CORS при локальной разработке не нужен.
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const target = env.DEV_API_PROXY || 'http://localhost:8080'
  return {
    plugins: [react()],
    server: {
      proxy: {
        '/api': { target, changeOrigin: true },
        '/media': { target, changeOrigin: true },
      },
    },
  }
})
