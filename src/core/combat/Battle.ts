import type { EffectResult } from '../effect/Effect'
import type { Skill } from '../skill/Skill'
import type { Combatant } from './Combatant'
import { calculateDamage } from './calculations'

/** 普通攻击记录实际扣血及目标死亡结果；死亡单位不能参与攻击。 */
export type AttackResult =
  | { success: false; reason: 'attackerDead' | 'targetDead' }
  | { success: true; attackerId: string; targetId: string; damage: number; targetHealth: number; targetDead: boolean }

/** 无法释放技能属于正常业务结果，失败时不扣魔法、不启动冷却。 */
export type CastResult =
  | { success: false; reason: 'casterDead' | 'targetDead' | 'cooldown' | 'insufficientMana' }
  | { success: true; casterId: string; targetId: string; skillId: string; effects: EffectResult[] }

/** 单场战斗协调器；调用方负责参与者、技能选择以及递增的逻辑时间。 */
export class Battle {
  private readonly cooldowns = new Map<Combatant, Map<string, number>>()

  /** 普攻独立于技能，不耗魔法；统一计算最终伤害后交给单位扣血。 */
  attack(attacker: Combatant, target: Combatant): AttackResult {
    if (!attacker.isAlive) return { success: false, reason: 'attackerDead' }
    if (!target.isAlive) return { success: false, reason: 'targetDead' }
    const damage = target.takeDamage(calculateDamage(attacker.stats, target.stats))
    return { success: true, attackerId: attacker.id, targetId: target.id, damage, targetHealth: target.health, targetDead: !target.isAlive }
  }

  /** 查询当前战斗中单位技能的剩余冷却；未释放过的技能立即可用。 */
  getRemainingCooldown(caster: Combatant, skill: Skill, nowMs: number): number {
    const readyAt = this.cooldowns.get(caster)?.get(skill.id) ?? 0
    return Math.max(0, readyAt - nowMs)
  }

  /** 校验存活、冷却与魔法后按顺序结算效果；不读取真实时间或创建定时器。 */
  castSkill(caster: Combatant, target: Combatant, skill: Skill, nowMs: number): CastResult {
    if (!caster.isAlive) return { success: false, reason: 'casterDead' }
    if (!target.isAlive) return { success: false, reason: 'targetDead' }
    if (this.getRemainingCooldown(caster, skill, nowMs) > 0) {
      return { success: false, reason: 'cooldown' }
    }
    if (!caster.consumeMana(skill.manaCost)) {
      return { success: false, reason: 'insufficientMana' }
    }

    // 冷却属于单位在本场战斗中的状态，不能写到多单位共用的技能对象上。
    let casterCooldowns = this.cooldowns.get(caster)
    if (!casterCooldowns) {
      casterCooldowns = new Map<string, number>()
      this.cooldowns.set(caster, casterCooldowns)
    }
    casterCooldowns.set(skill.id, nowMs + skill.cooldownMs)

    return {
      success: true,
      casterId: caster.id,
      targetId: target.id,
      skillId: skill.id,
      effects: skill.effects.map((effect) => effect.apply(caster, target)),
    }
  }
}
