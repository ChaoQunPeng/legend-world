import type { CombatStats } from '../combat/Combatant'

/** 职业成长表：每级属性增量与各级升下一级所需经验由内容配置提供。 */
export interface CharacterGrowth {
  readonly maxLevel: number
  readonly statsPerLevel: Readonly<CombatStats>
  readonly experienceToNextLevel: readonly number[]
}

/** 按当前等级重算职业属性，不修改初始配置，也不把装备加成计入成长。 */
export function calculateLevelStats(baseStats: Readonly<CombatStats>, growth: CharacterGrowth, level: number): CombatStats {
  const levels = level - 1
  const perLevel = growth.statsPerLevel
  return {
    maxHealth: baseStats.maxHealth + perLevel.maxHealth * levels,
    maxMana: baseStats.maxMana + perLevel.maxMana * levels,
    attack: baseStats.attack + perLevel.attack * levels,
    defense: baseStats.defense + perLevel.defense * levels,
    magicAttack: baseStats.magicAttack + perLevel.magicAttack * levels,
    magicDefense: baseStats.magicDefense + perLevel.magicDefense * levels,
    hitRate: baseStats.hitRate + perLevel.hitRate * levels,
  }
}

/** 一次经验结算的等级变化，供战斗日志记录本次升级而非推测历史。 */
export interface ExperienceGainResult {
  readonly previousLevel: number
  readonly level: number
}
