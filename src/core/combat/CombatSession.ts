import type { Character } from '../character/Character'
import type { ExperienceGainResult } from '../character/growth'
import type { Combatant } from './Combatant'
import type { Monster } from '../monster/Monster'
import type { Item } from '../item/Item'
import { rollDrops } from '../item/drops'
import type { RandomSource } from '../random/RandomSource'
import { Battle } from './Battle'

/** 单场战斗只能从待开始进入战斗，胜负确定后不能再次推进或领取奖励。 */
export type CombatStatus = 'idle' | 'running' | 'victory' | 'defeat'

/** 实际攻击记录供界面展示伤害、技能名和目标剩余生命。 */
export interface DamageRecord {
  type: 'damage'
  id: number
  timeMs: number
  attackerId: string
  attackerName: string
  targetId: string
  targetName: string
  actionName: string
  damage: number
  /** 未命中与命中但伤害为零分别记录，展示层不能仅通过伤害数值推断。 */
  hit: boolean
  targetHealth: number
}

/** 战斗结束记录包含本次实际发放的奖励，战败没有奖励。 */
export interface CombatEndRecord {
  type: 'end'
  id: number
  timeMs: number
  outcome: 'victory' | 'defeat'
  experience: number
  items: readonly Item[]
  /** 结算时留待手动领取的数量，日志避免将满包掉落描述为已入包。 */
  pendingItemCount: number
  /** 仅胜利结算经验时返回成长结果，日志直接读取本场发生的等级变化。 */
  growth: ExperienceGainResult | undefined
}

export type CombatRecord = DamageRecord | CombatEndRecord

/** 单场自动交战：只使用外部逻辑时间，核心不创建定时器或依赖界面。 */
export class CombatSession {
  private readonly battle: Battle
  private readonly character: Character
  private readonly monster: Monster
  private readonly random: RandomSource
  private statusValue: CombatStatus = 'idle'
  private nextActionMs = 1000
  private readonly history: CombatRecord[] = []

  /** 每场独立创建技能冷却和记录；参与者与奖励随机源均由宿主提供。 */
  constructor(character: Character, monster: Monster, random: RandomSource) {
    this.character = character
    this.monster = monster
    this.random = random
    this.battle = new Battle(random)
  }

  /** 界面据此禁用开始按钮，并在结束时停止时间推进。 */
  get status(): CombatStatus {
    return this.statusValue
  }

  /** 返回记录快照，界面不能修改核心维护的记录顺序。 */
  get records(): readonly CombatRecord[] {
    return [...this.history]
  }

  /** 只允许开始一次；已死亡单位不能进入新的战斗。 */
  start(): boolean {
    if (this.statusValue !== 'idle' || this.character.isInCombat || !this.character.isAlive || !this.monster.isAlive) return false
    this.statusValue = 'running'
    this.character.enterCombat()
    return true
  }

  /**
   * 推进到战斗开始后的累计毫秒；首次行动在第 1 秒，此后双方每秒行动。
   * 同时行动时角色先手，击杀后怪物不再反击；按每个行动点处理，保证长短推进一致。
   */
  advanceTo(elapsedMs: number): void {
    while (this.statusValue === 'running' && this.nextActionMs <= elapsedMs) {
      const timeMs = this.nextActionMs
      this.nextActionMs += 1000
      this.act(this.character, this.monster, timeMs)
      if (!this.monster.isAlive) {
        this.finish('victory', timeMs)
        break
      }
      this.act(this.monster, this.character, timeMs)
      if (!this.character.isAlive) this.finish('defeat', timeMs)
    }
  }

  /** 双方均按自身技能列表顺序尝试，每次行动最多释放一个技能，均不可用时普攻。 */
  private act(attacker: Combatant, target: Combatant, timeMs: number): void {
    for (const skill of attacker.skills) {
      // 被动属性已在最终属性中生效，不参与技能优先级尝试，也不占用本次行动。
      if (skill.type === 'passive') continue
      const cast = this.battle.castSkill(attacker, target, skill, timeMs)
      if (cast.success) {
        for (const effect of cast.effects) {
          if (effect.type === 'damage' || effect.type === 'physicalDamage') {
            this.recordDamage(attacker, target, skill.name, effect.amount, timeMs, effect.type === 'physicalDamage' ? effect.hit : true)
          }
        }
        return
      }
    }
    const attack = this.battle.attack(attacker, target)
    if (attack.success) this.recordDamage(attacker, target, '普通攻击', attack.damage, timeMs, attack.hit)
  }

  /** 记录实际扣血量，最后一击不会显示超过目标剩余生命的伤害。 */
  private recordDamage(attacker: Combatant, target: Combatant, actionName: string, damage: number, timeMs: number, hit: boolean): void {
    this.history.push({
      type: 'damage', id: this.history.length, timeMs,
      attackerId: attacker.id, attackerName: attacker.name,
      targetId: target.id, targetName: target.name,
      actionName, damage, hit, targetHealth: target.health,
    })
  }

  /** 先结束战斗再发奖，后续推进不会重复进入结算；战败发放 0 经验和空掉落。 */
  private finish(outcome: 'victory' | 'defeat', timeMs: number): void {
    this.statusValue = outcome
    this.character.leaveCombat()
    const experience = outcome === 'victory' ? this.monster.rewards.experience : 0
    const items = outcome === 'victory'
      ? rollDrops(this.monster.rewards.drops, `${this.monster.id}-drop`, this.random)
      : []
    let pendingItemCount = 0
    let growth: ExperienceGainResult | undefined
    if (outcome === 'victory') {
      growth = this.character.gainExperience(experience)
      for (const item of items) pendingItemCount += this.character.receiveItem(item).pending
    }
    this.history.push({ type: 'end', id: this.history.length, timeMs, outcome, experience, items, growth, pendingItemCount })
  }
}
