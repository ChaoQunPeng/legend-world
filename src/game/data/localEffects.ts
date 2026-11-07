import type { EffectDefinition } from '../../core'

/** 本地效果配置集中维护；技能引用配置，核心 Effect 负责执行状态变化。 */
export const localEffects = {
  /** 重击：仅为本次物理攻击增加 6，再按公共公式扣除目标防御。 */
  heavyStrike: {
    type: 'physicalDamage',
    target: 'target',
    attackBonus: 6,
  },
  /** 强力一击：本次物理攻击增加 10，仍使用目标防御计算伤害。 */
  powerStrike: {
    type: 'physicalDamage',
    target: 'target',
    attackBonus: 10,
  },
  /** 自我治疗：恢复自身 20 点生命，实际恢复量由生命上限约束。 */
  selfHeal: {
    type: 'heal',
    target: 'self',
    amount: 20,
  },
  /** 汲取打击的伤害部分：对目标造成固定 12 点伤害。 */
  drainDamage: {
    type: 'damage',
    target: 'target',
    amount: 12,
  },
  /** 汲取打击的恢复部分：固定恢复自身 6 点生命，不按实际伤害比例计算。 */
  drainHeal: {
    type: 'heal',
    target: 'self',
    amount: 6,
  },
} as const satisfies Record<string, EffectDefinition>
