import { Combatant } from '../combat/Combatant'
import type { CombatantOptions } from '../combat/Combatant'

/** 第一阶段支持的角色职业。 */
export type CharacterClass = 'warrior' | 'mage' | 'taoist'

/** 初始角色数据；职业配置提供属性，等级成长规则后续单独实现。 */
export interface CharacterOptions extends CombatantOptions {
  characterClass: CharacterClass
  level: number
}

/** 玩家角色，负责角色身份；共用战斗状态由 Combatant 维护。 */
export class Character extends Combatant {
  readonly characterClass: CharacterClass
  readonly level: number

  /** 根据已选职业的初始配置创建角色。 */
  constructor(options: CharacterOptions) {
    super(options)
    this.characterClass = options.characterClass
    this.level = options.level
  }
}
