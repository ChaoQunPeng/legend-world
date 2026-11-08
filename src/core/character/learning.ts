import type { CharacterClass } from './Character'
import type { SkillDefinition } from '../skill/Skill'

/** 职业技能目录与已学记录分离；主动技能在目录中的顺序规定释放优先级。 */
export interface CharacterSkillDefinition {
  readonly skill: SkillDefinition
  readonly requiredLevel: number
  readonly characterClass: CharacterClass
}

/** 学习条件检查供核心操作与页面按钮共用，失败不会改变已学技能。 */
export interface LearnSkillResult {
  readonly success: boolean
  readonly reason: 'unknown-skill' | 'already-learned' | 'in-combat' | 'class' | 'level' | undefined
}
