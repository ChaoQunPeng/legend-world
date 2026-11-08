import type { Character } from '../character/Character'
import type { Monster } from '../monster/Monster'
import type { RandomSource } from '../random/RandomSource'
import { CombatSession } from './CombatSession'
import type { CombatRecord } from './CombatSession'

/** 挂机阶段独立于单场胜负；停止请求不会暂停正在进行的战斗。 */
export type IdleCombatPhase = 'idle' | 'fighting' | 'waiting' | 'stopped' | 'dead'

/** 持续挂机协调器：复用单场战斗，只接受累计逻辑时间，不依赖真实时钟。 */
export class IdleCombatSession {
  private readonly character: Character
  private readonly createMonster: (battleNumber: number) => Monster
  private readonly random: RandomSource
  private session: CombatSession
  private monsterValue: Monster
  private phaseValue: IdleCombatPhase = 'idle'
  private timeValue = 0
  private battleStartedAt = 0
  private refreshAt = 0
  private copiedRecords = 0
  private stopRequestedValue = false
  private battleNumberValue = 1
  private killsValue = 0
  private readonly history: CombatRecord[] = []

  /** 首场使用世界已有怪物，后续每场通过工厂生成独立实例。 */
  constructor(
    character: Character,
    monster: Monster,
    createMonster: (battleNumber: number) => Monster,
    random: RandomSource,
  ) {
    this.character = character
    this.createMonster = createMonster
    this.random = random
    this.monsterValue = monster
    this.session = new CombatSession(character, monster, random)
  }

  /** 当前阶段决定宿主是否采样，死亡和停止期间不推进逻辑时间。 */
  get phase(): IdleCombatPhase { return this.phaseValue }
  /** 单场胜负仍供结果展示，不承担挂机启停判断。 */
  get status() { return this.session.status }
  /** 世界和页面读取正在挑战的同一个怪物实例。 */
  get monster(): Monster { return this.monsterValue }
  /** 实际消费的累计逻辑时间，停止后宿主从此处建立新时钟段。 */
  get elapsedMs(): number { return this.timeValue }
  /** 跨场记录统一时间与 ID，避免日志和动画复用单场编号。 */
  get records(): readonly CombatRecord[] { return [...this.history] }
  /** 当前挑战场次只在创建新怪物时递增。 */
  get battleNumber(): number { return this.battleNumberValue }
  /** 击杀计数仅在单场胜利结算后递增一次。 */
  get kills(): number { return this.killsValue }
  /** 已请求停止时，当前战斗仍应继续采样直至结算。 */
  get stopRequested(): boolean { return this.stopRequestedValue }
  /** 停止等待时保留剩余时间，再次开始不能绕过胜后两秒。 */
  get waitRemainingMs(): number { return Math.max(0, this.refreshAt - this.timeValue) }
  /** 战斗及等待都属于运行中，宿主只负责提供采样。 */
  get isActive(): boolean { return this.phaseValue === 'fighting' || this.phaseValue === 'waiting' }

  /** 手动开始或继续挂机，重复开始不能撤销停止请求或重领旧场奖励。 */
  start(): boolean {
    if (this.isActive || !this.character.isAlive) return false
    this.stopRequestedValue = false
    if (this.session.status === 'victory') {
      this.phaseValue = 'waiting'
      return true
    }
    if (this.session.status === 'defeat') this.createNextBattle()
    if (!this.session.start()) return false
    this.phaseValue = 'fighting'
    return true
  }

  /** 战中只登记停止请求；等待中立即停止，保留未消费的刷新时间。 */
  stop(): void {
    if (!this.isActive) return
    if (this.phaseValue === 'fighting') this.stopRequestedValue = true
    else this.phaseValue = 'stopped'
  }

  /** 死亡无额外惩罚，复活只恢复资源，后续必须再次手动开始。 */
  revive(): boolean {
    if (this.phaseValue !== 'dead' || !this.character.revive()) return false
    this.phaseValue = 'stopped'
    return true
  }

  /** 逐场消费战斗与等待，长推进遇到死亡或停止时停在真实结算点。 */
  advanceTo(elapsedMs: number): void {
    while (this.isActive && elapsedMs >= this.timeValue) {
      if (this.phaseValue === 'waiting') {
        if (elapsedMs < this.refreshAt) {
          this.timeValue = elapsedMs
          return
        }
        this.timeValue = this.refreshAt
        this.createNextBattle()
        this.session.start()
        this.phaseValue = 'fighting'
      }
      this.session.advanceTo(elapsedMs - this.battleStartedAt)
      const records = this.session.records
      for (const record of records.slice(this.copiedRecords)) {
        this.history.push({ ...record, id: this.history.length, timeMs: record.timeMs + this.battleStartedAt })
      }
      this.copiedRecords = records.length
      if (this.session.status === 'running') {
        this.timeValue = elapsedMs
        return
      }
      // 单场核心已先锁定结局并发奖；此处仅调度下一场，不能重复发放奖励。
      this.timeValue = this.history.at(-1)!.timeMs
      if (this.session.status === 'defeat') {
        this.phaseValue = 'dead'
        return
      }
      this.killsValue += 1
      this.refreshAt = this.timeValue + 2000
      this.phaseValue = this.stopRequestedValue ? 'stopped' : 'waiting'
    }
  }

  /** 新单场拥有独立 Battle 冷却，刷新不恢复角色资源。 */
  private createNextBattle(): void {
    this.battleNumberValue += 1
    this.monsterValue = this.createMonster(this.battleNumberValue)
    this.session = new CombatSession(this.character, this.monsterValue, this.random)
    this.battleStartedAt = this.timeValue
    this.copiedRecords = 0
  }
}
