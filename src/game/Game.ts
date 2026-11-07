import { Application } from 'pixi.js'
import { WorldScene } from './scenes/WorldScene'
import { worldConfig } from './scenes/worldConfig'

/** 游戏运行时：封装 PixiJS 和浏览器生命周期，React 无需管理场景细节。 */
export class Game {
  private readonly app = new Application()
  private readonly scene = new WorldScene()
  private readonly host: HTMLElement
  private readonly resizeObserver: ResizeObserver
  private pixelRatioQuery: MediaQueryList | null = null
  private initialized = false
  private disposed = false

  /** 每个宿主创建一个实例；构造后调用一次 init，卸载时调用 destroy。 */
  constructor(host: HTMLElement) {
    this.host = host
    this.resizeObserver = new ResizeObserver(this.resize)
    this.app.stage.addChild(this.scene.view)
  }

  /** 异步创建渲染器，成功后再挂载画布并启动 PixiJS 自有 Ticker。 */
  async init(): Promise<void> {
    try {
      await this.app.init({
        background: worldConfig.colors.outside,
        antialias: true,
        autoDensity: true,
        resolution: window.devicePixelRatio,
        autoStart: false,
        sharedTicker: false,
      })
    } catch (error) {
      // WebGL 等渲染器初始化失败时，释放已创建的世界图形并向界面报告。
      this.app.stage.destroy({ children: true })
      throw error
    }

    this.initialized = true

    // StrictMode 或页面卸载可能发生在 await 期间；旧实例不能再挂载画布。
    if (this.disposed) {
      this.app.destroy({ removeView: true }, { children: true })
      return
    }

    this.app.canvas.setAttribute('aria-hidden', 'true')
    this.host.appendChild(this.app.canvas)
    this.resizeObserver.observe(this.host)
    this.watchPixelRatio()
    this.resize()
    this.app.start()
  }

  /** 完整显示逻辑世界并居中；剩余区域留白，不拉伸或裁切场景。 */
  private readonly resize = (): void => {
    if (this.disposed) return

    const { width, height } = this.host.getBoundingClientRect()
    // 宿主被隐藏时没有可绘制面积，等 ResizeObserver 通知恢复后再更新。
    if (width === 0 || height === 0) return

    this.app.renderer.resize(width, height, window.devicePixelRatio)
    const scale = Math.min(width / worldConfig.width, height / worldConfig.height)
    this.scene.view.scale.set(scale)
    this.scene.view.position.set(
      (width - worldConfig.width * scale) / 2,
      (height - worldConfig.height * scale) / 2,
    )
  }

  /** 浏览器缩放或跨屏可能只改变像素比，因此单独监听分辨率变化。 */
  private readonly watchPixelRatio = (): void => {
    this.pixelRatioQuery?.removeEventListener('change', this.watchPixelRatio)
    this.pixelRatioQuery = window.matchMedia(`(resolution: ${window.devicePixelRatio}dppx)`)
    this.pixelRatioQuery.addEventListener('change', this.watchPixelRatio)
    this.resize()
  }

  /** 停止监听并销毁场景、渲染器和 Ticker；初始化中的实例由 init 收尾。 */
  destroy(): void {
    if (this.disposed) return
    this.disposed = true
    this.resizeObserver.disconnect()
    this.pixelRatioQuery?.removeEventListener('change', this.watchPixelRatio)

    if (this.initialized) {
      this.app.destroy({ removeView: true }, { children: true })
    }
  }
}
