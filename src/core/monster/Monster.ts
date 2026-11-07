import { Combatant } from '../combat/Combatant'
import type { CombatStats } from '../combat/Combatant'
import type { ItemDefinition } from '../item/Item'
import type { SkillDefinition } from '../skill/Skill'

/** 最小固定奖励配置：击杀经验与每次必掉的物品定义，不涉及随机掉落。 */
export interface MonsterRewards {
  readonly experience: number
  readonly drops: readonly ItemDefinition[]
}

/** 怪物分类用于后续配置奖励和行动策略。 */
export type MonsterRank = 'normal' | 'elite' | 'boss'

/** 同类怪物共用的静态定义，不保存某只怪物的当前生命。 */
export interface MonsterDefinition {
  readonly id: string
  readonly name: string
  readonly rank: MonsterRank
  readonly level: number
  readonly stats: Readonly<CombatStats>
  /** 怪物出生时加载的技能，按配置顺序尝试释放。 */
  readonly skills: readonly SkillDefinition[]
  readonly rewards: MonsterRewards
}

/** 怪物实例拥有独立的实例 ID、生命和魔法。 */
export class Monster extends Combatant {
  readonly definitionId: string
  readonly rank: MonsterRank
  readonly level: number
  readonly rewards: MonsterRewards

  /** 同一份怪物定义可以创建多只互不共享战斗状态的怪物。 */
  constructor(id: string, definition: MonsterDefinition) {
    super({ id, name: definition.name, stats: definition.stats, skills: definition.skills })
    this.definitionId = definition.id
    this.rank = definition.rank
    this.level = definition.level
    this.rewards = definition.rewards
  }
}
