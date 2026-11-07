import type { CombatStats } from './Combatant'

/** 本次攻击的临时加成，仅影响此次伤害，不写回角色的常驻属性。 */
export interface AttackParameters {
  attackBonus: number
}

/**
 * 统一物理伤害计算入口：接收双方已经汇总的最终属性，不修改单位或扣除生命。
 * 当前规则为攻击减防御，攻击不超过防御时伤害为 0；直接保留差值，不额外取整。
 * 技能、效果、物品后续接入伤害流程时，应先汇总属性及已确定的攻击参数，再复用此入口。
 */
export function calculateDamage(
  attackerStats: Readonly<CombatStats>,
  defenderStats: Readonly<CombatStats>,
  parameters: Readonly<AttackParameters> = { attackBonus: 0 },
): number {
  return Math.max(0, attackerStats.attack + parameters.attackBonus - defenderStats.defense)
}
