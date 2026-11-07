/** 基础战斗属性；攻击与防御字段暂不绑定尚未确定的伤害公式。 */
export interface CombatStats {
  maxHealth: number
  maxMana: number
  attack: number
  defense: number
  magicAttack: number
  magicDefense: number
}

/** 创建战斗单位所需的数据；实例 ID 由调用方生成。 */
export interface CombatantOptions {
  id: string
  name: string
  stats: Readonly<CombatStats>
}

/** 角色与怪物共用的战斗能力，生命和魔法只在此处维护。 */
export abstract class Combatant {
  readonly id: string
  readonly name: string
  private readonly baseStats: CombatStats
  private healthValue: number
  private manaValue: number

  /** 新建单位以满生命、满魔法进入游戏，不承担存档恢复职责。 */
  protected constructor(options: CombatantOptions) {
    this.id = options.id
    this.name = options.name
    this.baseStats = { ...options.stats }
    this.healthValue = options.stats.maxHealth
    this.manaValue = options.stats.maxMana
  }

  /** 返回属性快照，调用方不能通过修改快照影响单位。 */
  get stats(): Readonly<CombatStats> {
    return { ...this.baseStats }
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
    const actual = Math.min(amount, this.baseStats.maxHealth - this.healthValue)
    this.healthValue += actual
    return actual
  }

  /** 消耗非负魔法值；不足时保持原值，供技能释放返回业务失败。 */
  consumeMana(amount: number): boolean {
    if (this.manaValue < amount) return false
    this.manaValue -= amount
    return true
  }

  /** 恢复非负魔法值并返回实际恢复量，不超过魔法上限。 */
  restoreMana(amount: number): number {
    const actual = Math.min(amount, this.baseStats.maxMana - this.manaValue)
    this.manaValue += actual
    return actual
  }
}
