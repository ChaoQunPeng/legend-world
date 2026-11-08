import { calculateCombatStats } from './stats'
import { Skill } from '../skill/Skill'
import type { SkillDefinition } from '../skill/Skill'

/** 战斗属性结构，供基础配置、最终属性汇总与统一伤害计算共用。 */
export interface CombatStats {
  maxHealth: number
  maxMana: number
  attack: number
  defense: number
  magicAttack: number
  magicDefense: number
  /** 物理攻击命中率，使用 0～1 表示；本阶段不计算目标闪避。 */
  hitRate: number
}

/** 创建战斗单位所需的数据；stats 为职业或怪物配置提供的基础属性，实例 ID 由调用方生成。 */
export interface CombatantOptions {
  id: string
  name: string
  stats: Readonly<CombatStats>
  /** 单位拥有的技能配置；主动技能按顺序尝试，无可用主动技能时普通攻击。 */
  skills: readonly SkillDefinition[]
}

/** 角色与怪物共用的战斗能力，生命和魔法只在此处维护。 */
export abstract class Combatant {
  readonly id: string
  readonly name: string
  private readonly skillInstances: readonly Skill[]
  private readonly baseStats: CombatStats
  private healthValue: number
  private manaValue: number

  /** 新建单位以满生命、满魔法进入游戏，不承担存档恢复职责。 */
  protected constructor(options: CombatantOptions) {
    this.id = options.id
    this.name = options.name
    // 角色和怪物均从自身配置加载技能，冷却仍由战斗按单位独立维护。
    this.skillInstances = options.skills.map((definition) => new Skill(definition))
    this.baseStats = { ...options.stats }
    this.healthValue = options.stats.maxHealth
    this.manaValue = options.stats.maxMana
  }

  /** 怪物直接使用配置技能；角色通过覆盖此入口，只向战斗提供已经学会的技能。 */
  get skills(): readonly Skill[] {
    return this.skillInstances
  }

  /** 基础属性来自静态配置；角色和怪物均通过统一入口提供最终属性快照。 */
  get stats(): Readonly<CombatStats> {
    // 公共单位提供基础属性，角色在此基础上叠加已穿戴装备。
    return calculateCombatStats(this.baseStats)
  }

  /** 卸下或替换增加生命、魔法上限的装备时压回新上限；穿戴不恢复资源。 */
  protected clampVitalsToStats(): void {
    const stats = this.stats
    this.healthValue = Math.min(this.healthValue, stats.maxHealth)
    this.manaValue = Math.min(this.manaValue, stats.maxMana)
  }

  /** 当前生命由战斗方法维护。 */
  get health(): number {
    return this.healthValue
  }

  /** 当前魔法用于技能消耗。 */
  get mana(): number {
    return this.manaValue
  }

  /** 生命归零即死亡，角色复活和怪物刷新由各自业务后续实现。 */
  get isAlive(): boolean {
    return this.healthValue > 0
  }

  /** 接收已计算完成的非负伤害，返回实际损失的生命，超额伤害不扣成负数。 */
  takeDamage(amount: number): number {
    const actual = Math.min(amount, this.healthValue)
    this.healthValue -= actual
    return actual
  }

  /** 恢复非负生命值并返回实际恢复量；普通治疗不能复活死亡单位。 */
  restoreHealth(amount: number): number {
    if (!this.isAlive) return 0
    const actual = Math.min(amount, this.stats.maxHealth - this.healthValue)
    this.healthValue += actual
    return actual
  }

  /** 角色手动复活专用：按最终属性重置资源，普通治疗仍不能复活。 */
  protected refillVitals(): void {
    this.healthValue = this.stats.maxHealth
    this.manaValue = this.stats.maxMana
  }

  /** 消耗非负魔法值；不足时保持原值，供技能释放返回业务失败。 */
  consumeMana(amount: number): boolean {
    if (this.manaValue < amount) return false
    this.manaValue -= amount
    return true
  }

  /** 恢复非负魔法值并返回实际恢复量，不超过魔法上限。 */
  restoreMana(amount: number): number {
    const actual = Math.min(amount, this.stats.maxMana - this.manaValue)
    this.manaValue += actual
    return actual
  }
}

