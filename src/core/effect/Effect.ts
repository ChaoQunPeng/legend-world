import type { Combatant } from '../combat/Combatant'
import { calculateDamage } from '../combat/calculations'

/** 即时效果支持固定数值与按最终属性计算的物理伤害，暂不包含持续效果。 */
export type EffectType = 'damage' | 'physicalDamage' | 'heal' | 'restoreMana'

/** 固定效果使用非负 amount；物理伤害使用本次攻击加成，target 明确作用对象。 */
export type EffectDefinition = {
  readonly type: 'damage' | 'heal' | 'restoreMana'
  readonly target: 'self' | 'target'
  readonly amount: number
} | {
  /** 物理技能在统一公式中增加本次攻击，不直接指定扣血量。 */
  readonly type: 'physicalDamage'
  readonly target: 'target'
  readonly attackBonus: number
}

/** 结构化效果记录，保留实际变化量，供未来生成战斗日志。 */
export interface EffectResult {
  type: EffectType
  targetId: string
  amount: number
}

/** 将配置中的即时效果转换为战斗单位的状态变化。 */
export class Effect {
  private readonly definition: EffectDefinition

  /** 复制配置，避免外部修改对象影响已经创建的效果。 */
  constructor(definition: EffectDefinition) {
    this.definition = { ...definition }
  }

  /** 通过单位公开方法更新状态，不直接访问其内部生命和魔法。 */
  apply(caster: Combatant, target: Combatant): EffectResult {
    const recipient = this.definition.target === 'self' ? caster : target
    const { type } = this.definition
    let actual: number

    switch (this.definition.type) {
      case 'damage':
        actual = recipient.takeDamage(this.definition.amount)
        break
      case 'physicalDamage':
        actual = recipient.takeDamage(calculateDamage(caster.stats, recipient.stats, this.definition))
        break
      case 'heal':
        actual = recipient.restoreHealth(this.definition.amount)
        break
      case 'restoreMana':
        actual = recipient.restoreMana(this.definition.amount)
        break
    }

    return { type, targetId: recipient.id, amount: actual }
  }
}
