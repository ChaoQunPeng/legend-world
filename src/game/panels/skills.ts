import type { Character, CombatStats, LearnSkillResult } from '../../core'
import { classLabels, formatPercentage } from './unitInfo'
import { statLabels } from './inventory'
import { describeEffect } from './skillDescriptions'

/** 学习失败由核心给出原因，按钮与操作提示复用同一份中文说明。 */
export function describeLearnFailure(reason: LearnSkillResult['reason']): string | undefined {
  switch (reason) {
    case 'unknown-skill': return '没有这个技能'
    case 'already-learned': return '已学习'
    case 'in-combat': return '战斗中不可学习'
    case 'class': return '职业不符'
    case 'level': return '等级不足'
    case undefined: return undefined
  }
}

/** 技能目录始终显示，学习状态、条件与按钮权限读取当前角色快照。 */
export function readSkillBook(character: Character) {
  const learned = new Map(character.skills.map((skill) => [skill.id, skill]))
  let activePriority = 0
  return {
    learnedCount: learned.size,
    isInCombat: character.isInCombat,
    entries: character.skillCatalog.map(({ skill, requiredLevel, characterClass }) => {
      const result = character.checkLearnSkill(skill.id)
      return {
        id: skill.id, name: skill.name, type: skill.type,
        description: skill.description,
        priority: skill.type === 'active' ? ++activePriority : undefined,
        // 未学技能没有当前等级；已学等级读取核心实例，学习后默认为一级。
        level: learned.get(skill.id)?.level,
        requiredLevel, profession: classLabels[characterClass],
        manaCost: skill.type === 'active' ? skill.manaCost : undefined,
        cooldownSeconds: skill.type === 'active' ? skill.cooldownMs / 1000 : undefined,
        effects: skill.type === 'active' ? skill.effects.map(describeEffect)
          : Object.entries(skill.stats).map(([key, value]) => `${statLabels[key as keyof CombatStats]} +${key === 'hitRate' ? formatPercentage(value) : value}`),
        learned: learned.has(skill.id), canLearn: result.success,
        unavailableReason: describeLearnFailure(result.reason),
      }
    }),
  }
}

export type SkillBookView = ReturnType<typeof readSkillBook>
