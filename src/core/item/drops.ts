import { Item } from './Item'
import type { ItemDefinition, ItemQuality } from './Item'
import type { EquipmentStats } from '../combat/stats'
import type { RandomSource } from '../random/RandomSource'

/** 每条掉落独立判定一次，概率为 0～1，命中后创建一件物品。 */
export interface DropEntry {
  readonly item: ItemDefinition
  readonly probability: number
}

/** 品质只作标识，与基础属性、极品判定彼此独立。 */
export function generateEquipmentQuality(random: RandomSource): ItemQuality {
  const roll = random()
  if (roll < 0.7) return 'normal'
  if (roll < 0.9) return 'uncommon'
  if (roll < 0.98) return 'rare'
  return 'epic'
}

/** 20% 概率获得一项极品；属性等概率选择，+1～3 均匀取值。 */
export function generateExceptionalStats(random: RandomSource): Readonly<EquipmentStats> {
  if (random() >= 0.2) return {}
  const stat = random() < 0.5 ? 'attack' : 'defense'
  return { [stat]: Math.floor(random() * 3) + 1 }
}

/** 按表顺序判定掉落，命中的装备立即生成品质与极品，并固定在实例中。 */
export function rollDrops(entries: readonly DropEntry[], idPrefix: string, random: RandomSource): Item[] {
  const items: Item[] = []
  for (const [index, entry] of entries.entries()) {
    if (random() >= entry.probability) continue
    const result = entry.item.type === 'equipment'
      ? { quality: generateEquipmentQuality(random), additionalStats: generateExceptionalStats(random) }
      : undefined
    items.push(new Item(`${idPrefix}-${index}`, entry.item, 1, result))
  }
  return items
}
