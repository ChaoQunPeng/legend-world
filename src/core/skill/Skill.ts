import { Effect } from '../effect/Effect'
import type { EffectDefinition } from '../effect/Effect'

/** 当前只描述主动技能，耗蓝与冷却由战斗协调，时间单位为逻辑毫秒。 */
export interface SkillDefinition {
  readonly id: string
  readonly name: string
  readonly manaCost: number
  readonly cooldownMs: number
  readonly effects: readonly EffectDefinition[]
}

/** 技能持有规则配置，不保存某个角色的冷却状态，可供多个单位共用。 */
export class Skill {
  readonly id: string
  readonly name: string
  readonly manaCost: number
  readonly cooldownMs: number
  readonly effects: readonly Effect[]

  /** 按配置顺序创建效果；新增同类技能只需提供不同配置。 */
  constructor(definition: SkillDefinition) {
    this.id = definition.id
    this.name = definition.name
    this.manaCost = definition.manaCost
    this.cooldownMs = definition.cooldownMs
    this.effects = definition.effects.map((effect) => new Effect(effect))
  }
}
