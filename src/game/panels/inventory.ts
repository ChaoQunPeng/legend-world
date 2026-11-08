import type { Character, CombatStats, EquipCheck, EquipmentSlot, Item, ItemQuality, ItemType } from '../../core'
import { classLabels, formatPercentage } from './unitInfo'

/** 核心返回业务原因，展示层统一转换为按钮说明和操作提示。 */
export function describeEquipFailure(reason: EquipCheck['reason']): string | undefined {
  switch (reason) {
    case 'not-in-bag': return '物品不在背包中'
    case 'not-equipment': return '该物品不能穿戴'
    case 'level': return '等级不足'
    case 'class': return '职业不符'
    case undefined: return undefined
  }
}

/** 固定的装备部位顺序同时用于人物装备栏和物品部位名称。 */
export const equipmentSlots: readonly { slot: EquipmentSlot; label: string }[] = [
  { slot: 'weapon', label: '武器' }, { slot: 'helmet', label: '头盔' },
  { slot: 'armor', label: '衣服' }, { slot: 'boots', label: '鞋子' },
  { slot: 'necklace', label: '项链' }, { slot: 'ring', label: '戒指' },
]

const qualityLabels: Record<ItemQuality, string> = { normal: '普通', uncommon: '优秀', rare: '稀有', epic: '史诗' }
const typeLabels: Record<ItemType, string> = { equipment: '装备', material: '材料', consumable: '消耗品' }
export const statLabels: Record<keyof CombatStats, string> = {
  maxHealth: '生命上限', maxMana: '魔法上限', attack: '物理攻击',
  defense: '物理防御', magicAttack: '魔法攻击', magicDefense: '魔法防御',
  hitRate: '命中率',
}

/** 背包和装备栏共用只读展示数据，不向组件暴露核心可变实例。 */
export interface ItemView {
  readonly id: string
  readonly name: string
  readonly type: ItemType
  readonly quality: ItemQuality
  readonly qualityLabel: string
  readonly typeLabel: string
  readonly slotLabel: string | undefined
  readonly bonuses: readonly string[]
  readonly additionalBonuses: readonly string[]
  readonly quantity: number
  readonly maxStack: number
  readonly effectLabel: string | undefined
  readonly canUse: boolean
  readonly canEquip: boolean
  readonly equipFailure: string | undefined
  readonly requirementsLabel: string | undefined
}

/** 将装备属性解释为中文条目，材料没有部位或属性。 */
function readItem(item: Item, character: Character): ItemView {
  const check = character.checkEquip(item.id)
  const requirements = item.equipment?.requirements
  return {
    id: item.id, name: item.name, type: item.type, quality: item.quality,
    qualityLabel: qualityLabels[item.quality], typeLabel: typeLabels[item.type],
    slotLabel: equipmentSlots.find(({ slot }) => slot === item.equipment?.slot)?.label,
    bonuses: item.equipment ? Object.entries(item.equipment.stats).map(([key, value]) =>
      `${statLabels[key as keyof CombatStats]} ${value >= 0 ? '+' : ''}${key === 'hitRate' ? formatPercentage(value) : value}`) : [],
    additionalBonuses: Object.entries(item.additionalStats).map(([key, value]) =>
      `${statLabels[key as keyof CombatStats]} +${key === 'hitRate' ? formatPercentage(value) : value}`),
    quantity: item.quantity, maxStack: item.maxStack,
    effectLabel: item.effect?.type === 'heal' ? `恢复 ${item.effect.amount} 生命` : undefined,
    canUse: item.type === 'consumable' && character.isAlive && character.health < character.stats.maxHealth,
    canEquip: check.canEquip,
    equipFailure: describeEquipFailure(check.reason),
    requirementsLabel: requirements
      ? `需要 Lv.${requirements.level} · ${requirements.classes.length === 0 ? '不限职业' : requirements.classes.map((value) => classLabels[value]).join('、')}`
      : undefined,
  }
}

/** 直接展示核心真实格子，满堆叠分格显示；待领取列表与背包分别查询。 */
export function readInventory(character: Character) {
  const items = character.items.map((item) => readItem(item, character))
  const equipment = character.equipment
  return {
    items,
    itemCount: character.items.reduce((sum, item) => sum + item.quantity, 0),
    usedSlots: items.length, capacity: character.inventoryCapacity,
    pendingItems: character.pendingItems.map((item) => readItem(item, character)),
    equipment: equipmentSlots.map(({ slot, label }) => {
      const item = equipment.get(slot)
      return { slot, label, item: item ? readItem(item, character) : null }
    }),
  }
}

export type InventoryView = ReturnType<typeof readInventory>
