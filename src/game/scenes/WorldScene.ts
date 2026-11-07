import { Container, Graphics } from 'pixi.js'
import { worldConfig } from './worldConfig'

/** 初始世界场景：以本地图形绘制群山与石门，尚不包含角色和玩法。 */
export class WorldScene {
  readonly view = new Container()

  /** 所有图形共用逻辑坐标，缩放与资源释放交给 Game 统一处理。 */
  constructor() {
    const { width, height, colors } = worldConfig
    const landscape = new Graphics()
      .rect(0, 0, width, height).fill(colors.sky)
      .circle(925, 185, 66).fill({ color: colors.moon, alpha: 0.06 })
      .circle(925, 185, 45).fill({ color: colors.moon, alpha: 0.12 })
      .circle(925, 185, 31).fill(colors.moon)
      .poly([0, 470, 160, 245, 330, 430, 510, 230, 710, 470, 900, 305, 1100, 440, 1280, 270, 1280, 800, 0, 800]).fill(colors.distantMountain)
      .poly([0, 530, 180, 425, 370, 565, 600, 380, 830, 565, 1050, 405, 1280, 550, 1280, 800, 0, 800]).fill(colors.mountain)
      .poly([0, 650, 250, 610, 500, 635, 700, 595, 960, 630, 1280, 600, 1280, 800, 0, 800]).fill(colors.ground)
      .poly([570, 800, 635, 610, 680, 610, 790, 800]).fill(colors.path)

    // 石门作为场景视觉焦点，当前仅是景物，不暗示已实现传送功能。
    const gate = new Graphics()
      .rect(566, 402, 40, 224).fill(colors.stoneShadow)
      .rect(706, 402, 40, 224).fill(colors.stoneShadow)
      .rect(566, 402, 12, 224).fill(colors.stone)
      .rect(706, 402, 12, 224).fill(colors.stone)
      .poly([548, 395, 656, 366, 764, 395, 750, 422, 560, 422]).fill(colors.stone)
      .rect(593, 403, 126, 4).fill(colors.gold)
      .circle(656, 390, 6).fill(colors.gold)
      .rect(550, 622, 212, 12).fill(colors.stoneShadow)

    this.view.addChild(landscape, gate)
  }
}
