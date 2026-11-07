import type { EquipmentStats } from '../combat/stats'

/** 物品种类、品质和装备部位由核心统一定义。 */
export type ItemType = 'equipment' | 'consumable' | 'material'
export type ItemQuality = 'normal' | 'uncommon' | 'rare' | 'epic'
export type EquipmentSlot = 'weapon' | 'helmet' | 'armor' | 'boots' | 'necklace' | 'ring'

/** 装备必须声明部位和属性，材料与消耗品不携带穿戴信息。 */
export type ItemDefinition = {
  readonly id: string
  readonly name: string
  readonly quality: ItemQuality
} & ({ readonly type: 'equipment'; readonly equipment: EquipmentDefinition }
  | { readonly type: 'consumable' | 'material' })

/** 每个部位同时穿戴一件装备，属性沿用统一的战斗属性结构。 */
export interface EquipmentDefinition {
  readonly slot: EquipmentSlot
  readonly stats: Readonly<EquipmentStats>
}

/** 每件物品独立持有实例身份，穿脱在背包与装备栏之间转移同一实例。 */
export class Item {
  readonly id: string
  readonly definitionId: string
  readonly name: string
  readonly type: ItemType
  readonly quality: ItemQuality
  readonly equipment: EquipmentDefinition | undefined

  /** 同一种装备可拥有多个独立实例，穿戴元数据来自静态定义。 */
  constructor(id: string, definition: ItemDefinition) {
    this.id = id
    this.definitionId = definition.id
    this.name = definition.name
    this.type = definition.type
    this.quality = definition.quality
    this.equipment = definition.type === 'equipment' ? definition.equipment : undefined
  }
}
