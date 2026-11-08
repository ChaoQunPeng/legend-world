import type { EffectDefinition } from '../effect/Effect'
import type { EquipmentStats } from '../combat/stats'
import type { CharacterClass } from '../character/Character'

/** 物品种类、品质和装备部位由核心统一定义。 */
export type ItemType = 'equipment' | 'consumable' | 'material'
export type ItemQuality = 'normal' | 'uncommon' | 'rare' | 'epic'
export type EquipmentSlot = 'weapon' | 'helmet' | 'armor' | 'boots' | 'necklace' | 'ring'

/** 装备声明独立穿戴信息；材料与药水声明堆叠上限，药水复用自身治疗效果。 */
export type ItemDefinition = {
  readonly id: string
  readonly name: string
  readonly quality: ItemQuality
} & ({ readonly type: 'equipment'; readonly equipment: EquipmentDefinition }
  | { readonly type: 'material'; readonly maxStack: 99 }
  | { readonly type: 'consumable'; readonly maxStack: 20; readonly effect: EffectDefinition & { readonly type: 'heal'; readonly target: 'self' } })

/** 每个部位同时穿戴一件装备，属性沿用统一的战斗属性结构。 */
export interface EquipmentDefinition {
  readonly slot: EquipmentSlot
  readonly stats: Readonly<EquipmentStats>
  /** 空职业列表表示不限职业；等级条件由核心与面板共用。 */
  readonly requirements: { readonly level: number; readonly classes: readonly CharacterClass[] }
}

/** 掉落创建时传入已生成的结果，初始赠送物品沿用定义品质且没有极品。 */
export interface EquipmentRoll {
  readonly quality: ItemQuality
  readonly additionalStats: Readonly<EquipmentStats>
}

/** 装备独立持有实例身份，材料和药水以数量堆叠，穿脱在背包与装备栏之间转移同一实例。 */
export class Item {
  readonly id: string
  readonly definitionId: string
  readonly name: string
  readonly type: ItemType
  readonly quality: ItemQuality
  readonly equipment: EquipmentDefinition | undefined
  readonly additionalStats: Readonly<EquipmentStats>
  readonly maxStack: number
  readonly effect: EffectDefinition | undefined
  readonly quantity: number
  private readonly definition: ItemDefinition

  /** 装备默认单件创建，材料与药水可携带批量奖励数量，由背包按上限分格。 */
  constructor(id: string, definition: ItemDefinition, quantity = 1, roll?: EquipmentRoll) {
    this.definition = definition
    this.quantity = quantity
    this.maxStack = definition.type === 'equipment' ? 1 : definition.maxStack
    this.effect = definition.type === 'consumable' ? definition.effect : undefined
    this.id = id
    this.definitionId = definition.id
    this.name = definition.name
    this.type = definition.type
    this.quality = roll?.quality ?? definition.quality
    this.additionalStats = { ...roll?.additionalStats }
    this.equipment = definition.type === 'equipment' ? definition.equipment : undefined
  }

  /** 数量变化生成新快照；装备穿脱始终直接转移原实例。 */
  withQuantity(quantity: number, id = this.id): Item {
    return new Item(id, this.definition, quantity, { quality: this.quality, additionalStats: this.additionalStats })
  }
}
