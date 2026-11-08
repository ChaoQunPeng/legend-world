import { spawn } from 'node:child_process'
import electron from 'electron'
import { createServer } from 'vite'

// 等待 Vite 完成监听后再启动客户端，直接使用实际端口，支持多个项目同时开发。
const server = await createServer({ server: { host: '127.0.0.1' } })
await server.listen()
server.printUrls()

const child = spawn(electron, ['.'], {
  stdio: 'inherit',
  env: {
    ...process.env,
    ELECTRON_RENDERER_URL: server.resolvedUrls.local[0],
  },
})

// 桌面窗口退出时同时关闭热更新服务，避免开发端口被后台进程占用。
child.on('exit', async (code) => {
  await server.close()
  process.exitCode = code ?? 0
})

// 启动进程失败时释放 Vite 服务并报告实际错误。
child.on('error', async (error) => {
  console.error('Electron 启动失败：', error)
  await server.close()
  process.exitCode = 1
})

// 终端中断时一并结束客户端；服务由客户端退出回调统一关闭。
for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => child.kill(signal))
}
