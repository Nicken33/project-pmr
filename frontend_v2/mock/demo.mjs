// npm run demo — запускает тестовый API и сайт, открывает браузер.
import { spawn } from 'node:child_process'
import './server.mjs'

const vite = spawn('npx', ['vite', '--open', '--port', '5173'], {
  stdio: 'inherit',
  shell: true,
  env: { ...process.env, DEV_API_PROXY: 'http://localhost:8099', VITE_FEATURES: 'all' },
})
vite.on('exit', (code) => process.exit(code ?? 0))
