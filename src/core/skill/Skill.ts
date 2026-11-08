import { Effect } from '../effect/Effect'
import type { EffectDefinition } from '../effect/Effect'
import type { CombatStats } from '../combat/Combatant'

/** 主动技能声明即时效果，被动技能只声明持续属性加成，不能主动释放。 */
export type SkillDefinition = {
  readonly id: string
  readonly name: string
  /** 面向玩家的技能说明；旧配置未填写时仍展示自动生成的效果规则。 */
  readonly description?: string
} & ({
  readonly type: 'active'
  readonly manaCost: number
  readonly cooldownMs: number
  readonly effects: readonly EffectDefinition[]
} | {
  readonly type: 'passive'
  readonly stats: Readonly<Partial<CombatStats>>
})

/** 技能持有规则配置，不保存某个角色的冷却状态，可供多个单位共用。 */
export class Skill {
  readonly id: string
  readonly name: string
  readonly type: 'active' | 'passive'
  /** 当前阶段所有技能固定为一级，升级条件与多等级效果暂不实现。 */
  readonly level = 1
  readonly manaCost: number
  readonly cooldownMs: number
  readonly effects: readonly Effect[]
  readonly passiveStats: Readonly<Partial<CombatStats>>

  /** 主动技能按顺序创建效果，被动复制属性加成；新增同类技能通过配置完成。 */
  constructor(definition: SkillDefinition) {
    this.id = definition.id
    this.name = definition.name
    this.type = definition.type
    // 被动技能不产生即时效果、耗蓝或冷却，属性只在角色汇总入口读取。
    this.manaCost = definition.type === 'active' ? definition.manaCost : 0
    this.cooldownMs = definition.type === 'active' ? definition.cooldownMs : 0
    this.effects = definition.type === 'active' ? definition.effects.map((effect) => new Effect(effect)) : []
    this.passiveStats = definition.type === 'passive' ? { ...definition.stats } : {}
  }
}
