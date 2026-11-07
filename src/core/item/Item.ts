/** 初期物品种类与品质，仅描述身份，具体使用及装备规则后续实现。 */
export type ItemType = 'equipment' | 'consumable' | 'material'
export type ItemQuality = 'normal' | 'uncommon' | 'rare' | 'epic'

/** 静态物品定义与玩家拥有的实例分离；装备附加属性尚未纳入本轮。 */
export interface ItemDefinition {
  readonly id: string
  readonly name: string
  readonly type: ItemType
  readonly quality: ItemQuality
}

/** 一件实际物品的身份；本轮不引入堆叠、背包或装备穿戴。 */
export class Item {
  readonly id: string
  readonly definitionId: string
  readonly name: string
  readonly type: ItemType
  readonly quality: ItemQuality

  /** 实例 ID 与定义 ID 分开，同一种装备可拥有多个独立实例。 */
  constructor(id: string, definition: ItemDefinition) {
    this.id = id
    this.definitionId = definition.id
    this.name = definition.name
    this.type = definition.type
    this.quality = definition.quality
  }
}
