import type { CombatStats } from './Combatant'

/** 装备层只提供实际增加的字段，由角色汇总已穿戴装备的加成。 */
export type EquipmentStats = Partial<CombatStats>

/**
 * 最终战斗属性的统一计算入口：基础属性加上装备附加属性。
 * 未配置加成的属性按 0 计算，不修改传入的配置。
 */
export function calculateCombatStats(
  baseStats: Readonly<CombatStats>,
  equipmentStats: Readonly<EquipmentStats> = {},
): CombatStats {
  return {
    maxHealth: baseStats.maxHealth + (equipmentStats.maxHealth ?? 0),
    maxMana: baseStats.maxMana + (equipmentStats.maxMana ?? 0),
    attack: baseStats.attack + (equipmentStats.attack ?? 0),
    defense: baseStats.defense + (equipmentStats.defense ?? 0),
    magicAttack: baseStats.magicAttack + (equipmentStats.magicAttack ?? 0),
    magicDefense: baseStats.magicDefense + (equipmentStats.magicDefense ?? 0),
  }
}
