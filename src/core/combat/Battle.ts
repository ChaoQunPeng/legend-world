import type { EffectResult } from '../effect/Effect'
import type { Skill } from '../skill/Skill'
import type { Combatant } from './Combatant'
import { calculateDamage, rollHit } from './calculations'
import type { RandomSource } from '../random/RandomSource'

/** 普通攻击记录实际扣血及目标死亡结果；死亡单位不能参与攻击。 */
export type AttackResult =
  | { success: false; reason: 'attackerDead' | 'targetDead' }
  | { success: true; attackerId: string; targetId: string; hit: boolean; damage: number; targetHealth: number; targetDead: boolean }

/** 无法释放技能属于正常业务结果，失败时不扣魔法、不启动冷却。 */
export type CastResult =
  | { success: false; reason: 'casterDead' | 'targetDead' | 'skillNotLearned' | 'passiveSkill' | 'cooldown' | 'insufficientMana' }
  | { success: true; casterId: string; targetId: string; skillId: string; effects: EffectResult[] }

/** 单场战斗协调器；调用方负责参与者、技能选择以及递增的逻辑时间。 */
export class Battle {
  private readonly cooldowns = new Map<Combatant, Map<string, number>>()
  private readonly random: RandomSource

  /** 命中随机源由宿主注入，普攻和技能共用同一条确定的随机输入序列。 */
  constructor(random: RandomSource) {
    this.random = random
  }

  /** 普攻独立于技能，不耗魔法；统一计算最终伤害后交给单位扣血。 */
  attack(attacker: Combatant, target: Combatant): AttackResult {
    if (!attacker.isAlive) return { success: false, reason: 'attackerDead' }
    if (!target.isAlive) return { success: false, reason: 'targetDead' }
    const hit = rollHit(attacker.stats, this.random)
    const damage = hit ? target.takeDamage(calculateDamage(attacker.stats, target.stats)) : 0
    return { success: true, attackerId: attacker.id, targetId: target.id, hit, damage, targetHealth: target.health, targetDead: !target.isAlive }
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
    // 角色只暴露已学技能，怪物只暴露自身配置技能；外部不能借用其他技能绕过归属校验。
    if (!caster.skills.includes(skill)) return { success: false, reason: 'skillNotLearned' }
    // 被动即使已经学习也不能主动施放，避免零耗蓝、零冷却的被动阻塞普通攻击。
    if (skill.type === 'passive') return { success: false, reason: 'passiveSkill' }
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

    // 一次释放只为所有物理效果判定一次；即使未命中，耗蓝与冷却也已正常生效。
    const physicalHit = !skill.effects.some((effect) => effect.type === 'physicalDamage') || rollHit(caster.stats, this.random)

    return {
      success: true,
      casterId: caster.id,
      targetId: target.id,
      skillId: skill.id,
      effects: skill.effects.map((effect) => effect.apply(caster, target, physicalHit)),
    }
  }
}
