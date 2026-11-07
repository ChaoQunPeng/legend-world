import { Container, Graphics, Text } from 'pixi.js'
import type { LocalWorld } from '../data/localWorld'
import { worldConfig } from './worldConfig'

/** 初始世界场景：以本地图形绘制景物和本地单位，暂不包含移动与战斗。 */
export class WorldScene {
  readonly view = new Container()

  /** 所有图形共用逻辑坐标，缩放与资源释放交给 Game 统一处理。 */
  constructor(localWorld: LocalWorld) {
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
    this.addCharacter(localWorld)
    this.addMonster(localWorld)
  }

  /** 战士使用披风、护甲与剑的本地矢量形象，名称与等级来自角色实例。 */
  private addCharacter({ character }: LocalWorld): void {
    const figure = new Container()
    figure.position.set(480, 500)
    const body = new Graphics()
      .ellipse(0, 45, 30, 8).fill({ color: 0x000000, alpha: 0.3 })
      .poly([-12, -13, 12, -13, 24, 40, -24, 40]).fill(0x854d46)
      .rect(-12, -10, 24, 32).fill(0x839aa3)
      .rect(-12, 22, 9, 22).fill(0x394553)
      .rect(3, 22, 9, 22).fill(0x394553)
      .circle(0, -24, 13).fill(0xdbc19c)
      .poly([-14, -26, 0, -42, 14, -26]).fill(0x839aa3)
      .rect(25, -30, 5, 45).fill(0xe9d9af)
      .rect(19, 10, 17, 4).fill(0xc7a875)
      .rect(25, 14, 5, 12).fill(0x854d46)
    figure.addChild(body, this.createLabel(`${character.name} · Lv.${character.level}`, 0xe9d9af))
    this.view.addChild(figure)
  }

  /** 野狼以四足和尖耳区分角色；展示同一只本地怪物实例的名称和等级。 */
  private addMonster({ monster }: LocalWorld): void {
    const figure = new Container()
    figure.position.set(825, 505)
    const body = new Graphics()
      .ellipse(0, 40, 43, 8).fill({ color: 0x000000, alpha: 0.3 })
      .poly([22, 0, 54, -16, 40, 12, 20, 19]).fill(0x637482)
      .ellipse(0, 10, 33, 20).fill(0x8395a0)
      .rect(-23, 18, 9, 22).fill(0x637482)
      .rect(15, 18, 9, 22).fill(0x637482)
      .poly([-38, -8, -39, -30, -24, -17, -12, -29, -9, -2, -19, 18, -46, 8]).fill(0x9dabb2)
      .circle(-32, -3, 3).fill(0xe9bc76)
      .circle(-45, 6, 4).fill(0x263746)
    figure.addChild(body, this.createLabel(`${monster.name} · Lv.${monster.level}`, 0xe0a19a))
    this.view.addChild(figure)
  }

  /** 名牌固定在单位头顶，随世界一起缩放并由场景统一销毁。 */
  private createLabel(text: string, fill: number): Text {
    const label = new Text({
      text,
      style: { fontFamily: 'PingFang SC, Microsoft YaHei, sans-serif', fontSize: 18, fill },
    })
    label.anchor.set(0.5, 1)
    label.position.set(0, -54)
    return label
  }
}
