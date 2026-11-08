import type { SkillDefinition } from '../../core'
import { localEffects } from './localEffects'

/** 本地技能配置：主动技能参与战斗，被动技能通过角色已学记录汇总属性。 */
export const localSkills = {
  /** 野狼优先撕咬，零耗魔、三秒冷却，冷却期间由自动战斗回退普攻。 */
  wolfBite: {
    id: 'wolf-bite', name: '撕咬', type: 'active', manaCost: 0, cooldownMs: 3000,
    effects: [localEffects.wolfBite],
  },
  /** 重击沿用原有攻击加成，统一为耗蓝 5、冷却 1 秒。 */
  heavyStrike: {
    type: 'active',
    id: 'heavy-strike', name: '重击', manaCost: 5, cooldownMs: 1000,
    effects: [localEffects.heavyStrike],
  },
  /** 强力一击通过配置复用现有物理伤害效果。 */
  powerStrike: {
    type: 'active',
    id: 'power-strike', name: '强力一击', manaCost: 5, cooldownMs: 1000,
    effects: [localEffects.powerStrike],
  },
  /** 自我治疗只恢复施法者生命。 */
  selfHeal: {
    type: 'active',
    id: 'self-heal', name: '自我治疗', manaCost: 5, cooldownMs: 1000,
    effects: [localEffects.selfHeal],
  },
  /** 汲取打击按顺序造成固定伤害并恢复自身生命。 */
  drainingStrike: {
    type: 'active',
    id: 'draining-strike', name: '汲取打击', manaCost: 5, cooldownMs: 1000,
    effects: [localEffects.drainDamage, localEffects.drainHeal],
  },
  /** 强健体魄只增加生命上限，学习不恢复生命，也不占用战斗行动。 */
  strongBody: {
    id: 'strong-body', name: '强健体魄', type: 'passive',
    stats: { maxHealth: 20 },
  },
} as const satisfies Record<string, SkillDefinition>
