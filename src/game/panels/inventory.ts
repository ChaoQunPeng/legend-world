import type { Character, CombatStats, EquipmentSlot, Item, ItemQuality, ItemType } from '../../core'

/** 固定的装备部位顺序同时用于人物装备栏和物品部位名称。 */
export const equipmentSlots: readonly { slot: EquipmentSlot; label: string }[] = [
  { slot: 'weapon', label: '武器' }, { slot: 'helmet', label: '头盔' },
  { slot: 'armor', label: '衣服' }, { slot: 'boots', label: '鞋子' },
  { slot: 'necklace', label: '项链' }, { slot: 'ring', label: '戒指' },
]

const qualityLabels: Record<ItemQuality, string> = { normal: '普通', uncommon: '优秀', rare: '稀有', epic: '史诗' }
const typeLabels: Record<ItemType, string> = { equipment: '装备', material: '材料', consumable: '消耗品' }
const statLabels: Record<keyof CombatStats, string> = {
  maxHealth: '生命上限', maxMana: '魔法上限', attack: '物理攻击',
  defense: '物理防御', magicAttack: '魔法攻击', magicDefense: '魔法防御',
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
  readonly quantity: number
}

/** 将装备属性解释为中文条目，材料没有部位或属性。 */
function readItem(item: Item): ItemView {
  return {
    id: item.id, name: item.name, type: item.type, quality: item.quality,
    qualityLabel: qualityLabels[item.quality], typeLabel: typeLabels[item.type],
    slotLabel: equipmentSlots.find(({ slot }) => slot === item.equipment?.slot)?.label,
    bonuses: item.equipment ? Object.entries(item.equipment.stats).map(([key, value]) =>
      `${statLabels[key as keyof CombatStats]} ${value >= 0 ? '+' : ''}${value}`) : [],
    quantity: 1,
  }
}

/** 装备逐件展示以支持独立穿戴；同定义材料和消耗品合并显示数量，核心仍保留独立实例。 */
export function readInventory(character: Character) {
  const items: ItemView[] = []
  const grouped = new Map<string, number>()
  for (const item of character.items) {
    const index = grouped.get(item.definitionId)
    if (item.type !== 'equipment' && index !== undefined) {
      items[index] = { ...items[index], quantity: items[index].quantity + 1 }
    } else {
      if (item.type !== 'equipment') grouped.set(item.definitionId, items.length)
      items.push(readItem(item))
    }
  }
  const equipment = character.equipment
  return {
    items,
    itemCount: character.items.length,
    equipment: equipmentSlots.map(({ slot, label }) => {
      const item = equipment.get(slot)
      return { slot, label, item: item ? readItem(item) : null }
    }),
  }
}

export type InventoryView = ReturnType<typeof readInventory>
