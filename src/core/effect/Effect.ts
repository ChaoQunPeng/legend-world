import type { Combatant } from '../combat/Combatant'
import { calculateDamage } from '../combat/calculations'

/** 即时效果支持固定数值与按最终属性计算的物理伤害，暂不包含持续效果。 */
export type EffectType = 'damage' | 'physicalDamage' | 'heal' | 'restoreMana'

/** 固定效果使用非负 amount；物理伤害使用本次攻击加成，target 明确作用对象。 */
export type EffectDefinition = {
  /** 面向玩家的效果说明；可选以兼容已有配置，缺省时按类型和数值生成说明。 */
  readonly description?: string
} & ({
  readonly type: 'damage' | 'heal' | 'restoreMana'
  readonly target: 'self' | 'target'
  readonly amount: number
} | {
  /** 物理技能在统一公式中增加本次攻击，不直接指定扣血量。 */
  readonly type: 'physicalDamage'
  readonly target: 'target'
  readonly attackBonus: number
})

/** 结构化效果记录，保留实际变化量，供未来生成战斗日志。 */
export type EffectResult = {
  type: 'physicalDamage'
  targetId: string
  amount: number
  hit: boolean
} | {
  type: 'damage' | 'heal' | 'restoreMana'
  targetId: string
  amount: number
}

/** 将配置中的即时效果转换为战斗单位的状态变化。 */
export class Effect {
  readonly type: EffectType
  private readonly definition: EffectDefinition

  /** 复制配置，避免外部修改对象影响已经创建的效果。 */
  constructor(definition: EffectDefinition) {
    this.definition = { ...definition }
    this.type = definition.type
  }

  /** 战斗传入整次物理技能的命中结果；直接应用即时效果默认生效，恢复效果不判命中。 */
  apply(caster: Combatant, target: Combatant, physicalHit = true): EffectResult {
    const recipient = this.definition.target === 'self' ? caster : target
    const definition = this.definition
    if (definition.type === 'physicalDamage') {
      const amount = physicalHit ? recipient.takeDamage(calculateDamage(caster.stats, recipient.stats, definition)) : 0
      return { type: 'physicalDamage', targetId: recipient.id, amount, hit: physicalHit }
    }
    let actual: number

    switch (definition.type) {
      case 'damage':
        actual = recipient.takeDamage(definition.amount)
        break
      case 'heal':
        actual = recipient.restoreHealth(definition.amount)
        break
      case 'restoreMana':
        actual = recipient.restoreMana(definition.amount)
        break
    }

    return { type: definition.type, targetId: recipient.id, amount: actual }
  }
}
