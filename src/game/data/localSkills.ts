import type { SkillDefinition } from '../../core'
import { localEffects } from './localEffects'

/** 本地通用技能配置：角色和怪物均可使用，冷却状态由各自所在战斗维护。 */
export const localSkills = {
  /** 重击沿用原有攻击加成，统一为耗蓝 5、冷却 1 秒。 */
  heavyStrike: {
    id: 'heavy-strike', name: '重击', manaCost: 5, cooldownMs: 1000,
    effects: [localEffects.heavyStrike],
  },
  /** 强力一击通过配置复用现有物理伤害效果。 */
  powerStrike: {
    id: 'power-strike', name: '强力一击', manaCost: 5, cooldownMs: 1000,
    effects: [localEffects.powerStrike],
  },
  /** 自我治疗只恢复施法者生命。 */
  selfHeal: {
    id: 'self-heal', name: '自我治疗', manaCost: 5, cooldownMs: 1000,
    effects: [localEffects.selfHeal],
  },
  /** 汲取打击按顺序造成固定伤害并恢复自身生命。 */
  drainingStrike: {
    id: 'draining-strike', name: '汲取打击', manaCost: 5, cooldownMs: 1000,
    effects: [localEffects.drainDamage, localEffects.drainHeal],
  },
} as const satisfies Record<string, SkillDefinition>
