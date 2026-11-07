import type { Combatant } from '../combat/Combatant'

/** 先支持即时数值效果；持续效果和伤害公式尚未纳入本轮。 */
export type EffectType = 'damage' | 'heal' | 'restoreMana'

/** amount 为非负固定数值，target 明确作用于释放者还是技能目标。 */
export interface EffectDefinition {
  readonly type: EffectType
  readonly target: 'self' | 'target'
  readonly amount: number
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
    const { type, amount } = this.definition
    let actual: number

    switch (type) {
      case 'damage':
        actual = recipient.takeDamage(amount)
        break
      case 'heal':
        actual = recipient.restoreHealth(amount)
        break
      case 'restoreMana':
        actual = recipient.restoreMana(amount)
        break
    }

    return { type, targetId: recipient.id, amount: actual }
  }
}
