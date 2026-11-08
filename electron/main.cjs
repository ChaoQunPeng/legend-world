const { app, BrowserWindow } = require('electron')
const path = require('node:path')

// 创建游戏桌面窗口；开发时连接 Vite，发布后读取随客户端分发的页面。
function createWindow() {
  const window = new BrowserWindow({
    title: '传奇世界 · Legend World',
    width: 1440,
    height: 960,
    minWidth: 960,
    minHeight: 640,
    backgroundColor: '#101014',
    autoHideMenuBar: true,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
    },
  })

  // 游戏只在当前窗口内运行，禁止页面额外创建桌面窗口。
  window.webContents.setWindowOpenHandler(() => ({ action: 'deny' }))

  if (!app.isPackaged && process.env.ELECTRON_RENDERER_URL) {
    return window.loadURL(process.env.ELECTRON_RENDERER_URL)
  }

  return window.loadFile(path.join(__dirname, '../dist/index.html'))
}

// Electron 就绪后才创建窗口；macOS 点击 Dock 图标时恢复游戏窗口。
app.whenReady().then(async () => {
  await createWindow()
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow().catch(reportStartupError)
    }
  })
}).catch(reportStartupError)

// 页面加载失败时输出错误并退出，避免留下无法使用的空白客户端。
function reportStartupError(error) {
  console.error('游戏客户端启动失败：', error)
  app.exit(1)
}

// Windows 和 Linux 关闭所有窗口即退出，macOS 保留标准 Dock 生命周期。
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
