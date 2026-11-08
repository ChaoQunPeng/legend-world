import type { CharacterGrowth } from '../../core'

/** 已确认的战士成长：最高 60 级，L 级升级消耗 20 × L 经验。 */
export const warriorGrowth: CharacterGrowth = {
  maxLevel: 60,
  experienceToNextLevel: Array.from({ length: 59 }, (_, index) => 20 * (index + 1)),
  statsPerLevel: {
    maxHealth: 12, maxMana: 2, attack: 2, defense: 1, magicAttack: 0, magicDefense: 0,
    hitRate: 0,
  },
}
