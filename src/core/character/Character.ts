import { Inventory } from '../item/Inventory'
import type { ReceiveItemResult } from '../item/Inventory'
import { Effect } from '../effect/Effect'
import type { EffectResult } from '../effect/Effect'
import { Combatant } from '../combat/Combatant'
import type { CombatantOptions } from '../combat/Combatant'
import type { EquipmentSlot, Item } from '../item/Item'
import { calculateCombatStats } from '../combat/stats'
import type { CombatStats } from '../combat/Combatant'
import { calculateLevelStats } from './growth'
import type { CharacterGrowth, ExperienceGainResult } from './growth'
import type { CharacterSkillDefinition, LearnSkillResult } from './learning'
import type { Skill } from '../skill/Skill'

/** 第一阶段支持的角色职业。 */
export type CharacterClass = 'warrior' | 'mage' | 'taoist'

/** 穿戴检查同时供实际操作和按钮提示使用，避免页面另写一套规则。 */
export interface EquipCheck {
  readonly canEquip: boolean
  readonly reason: 'not-in-bag' | 'not-equipment' | 'level' | 'class' | undefined
}

/** 初始角色数据；stats 为职业一级属性，growth 提供等级成长与经验表。 */
export interface CharacterOptions extends Omit<CombatantOptions, 'skills'> {
  characterClass: CharacterClass
  level: number
  growth: CharacterGrowth
  skills: readonly CharacterSkillDefinition[]
  learnedSkillIds: readonly string[]
}

/** 玩家角色负责身份、背包与穿戴；共用战斗状态由 Combatant 维护。 */
export class Character extends Combatant {
  readonly characterClass: CharacterClass
  private levelValue: number
  readonly growth: CharacterGrowth
  private experienceValue = 0
  private levelExperienceValue = 0
  private readonly inventory = new Inventory()
  private readonly equippedItems = new Map<EquipmentSlot, Item>()
  readonly skillCatalog: readonly CharacterSkillDefinition[]
  private readonly learnedIds: Set<string>
  private inCombatValue = false

  /** 根据已选职业的初始配置创建角色。 */
  constructor(options: CharacterOptions) {
    super({ ...options, skills: options.skills.map((entry) => entry.skill) })
    this.characterClass = options.characterClass
    this.levelValue = options.level
    this.growth = options.growth
    this.skillCatalog = options.skills
    this.learnedIds = new Set(options.learnedSkillIds)
    // 从指定等级创建的角色也使用该等级属性，并以满状态进入游戏。
    this.restoreHealth(this.stats.maxHealth)
    this.restoreMana(this.stats.maxMana)
  }

  /** 技能按职业目录顺序提供，学习先后不会改变已确认的释放优先级。 */
  override get skills(): readonly Skill[] {
    return super.skills.filter((skill) => this.learnedIds.has(skill.id))
  }

  /** 返回已学技能 ID 快照，目录中的未学技能不能参与战斗。 */
  get learnedSkillIds(): readonly string[] {
    return this.skills.map((skill) => skill.id)
  }

  /** 战斗状态由协调器维护，学习方法本身也会校验，不能绕过页面限制。 */
  get isInCombat(): boolean {
    return this.inCombatValue
  }

  /** 单场开始后锁定技能学习，战斗中的穿脱与用药规则不受影响。 */
  enterCombat(): void {
    this.inCombatValue = true
  }

  /** 胜负确定后解除学习锁定，后续可按当前等级手动学习。 */
  leaveCombat(): void {
    this.inCombatValue = false
  }

  /** 死亡后手动复活，不发放奖励、不启动战斗，也不改变成长和物品。 */
  revive(): boolean {
    if (this.isAlive || this.isInCombat) return false
    this.refillVitals()
    return true
  }

  /** 检查已学记录、战斗状态、职业与等级，不消耗经验或物品。 */
  checkLearnSkill(skillId: string): LearnSkillResult {
    const entry = this.skillCatalog.find((value) => value.skill.id === skillId)
    if (!entry) return { success: false, reason: 'unknown-skill' }
    if (this.learnedIds.has(skillId)) return { success: false, reason: 'already-learned' }
    if (this.isInCombat) return { success: false, reason: 'in-combat' }
    if (this.characterClass !== entry.characterClass) return { success: false, reason: 'class' }
    if (this.level < entry.requiredLevel) return { success: false, reason: 'level' }
    return { success: true, reason: undefined }
  }

  /** 非战斗时手动学习；主动技能按目录参与战斗，被动技能直接纳入属性汇总。 */
  learnSkill(skillId: string): LearnSkillResult {
    const result = this.checkLearnSkill(skillId)
    if (result.success) this.learnedIds.add(skillId)
    return result
  }

  /** 等级只能由经验结算推进，外部读取不能绕过成长流程。 */
  get level(): number {
    return this.levelValue
  }

  /** 累计经验保留所有奖励，不因升级扣除，供角色履历展示。 */
  get experience(): number {
    return this.experienceValue
  }

  /** 当前等级已积累的经验，升级时扣除本级消耗。 */
  get levelExperience(): number {
    return this.levelExperienceValue
  }

  /** 满级不再有下一级目标，展示层据此切换为满级状态。 */
  get experienceToNextLevel(): number | undefined {
    return this.level < this.growth.maxLevel ? this.growth.experienceToNextLevel[this.level - 1] : undefined
  }

  /** 暴露当前职业成长属性，方便面板与最终战斗属性区分装备加成。 */
  get levelStats(): Readonly<CombatStats> {
    return calculateLevelStats(super.stats, this.growth, this.level)
  }

  /** 返回背包中未穿戴的物品快照，装备栏单独保存已穿戴实例。 */
  get items(): readonly Item[] {
    return this.inventory.items
  }

  /** 装备栏返回独立快照，外部只能通过穿脱方法改变物品归属。 */
  get equipment(): ReadonlyMap<EquipmentSlot, Item> {
    return new Map(this.equippedItems)
  }

  /** 等级、装备与已学被动按固定入口汇总；查询只计算快照，不累加回基础属性。 */
  override get stats(): Readonly<CombatStats> {
    let stats = this.levelStats
    for (const item of this.equippedItems.values()) {
      stats = calculateCombatStats(stats, item.equipment!.stats)
      // 极品仅属于当前实例，与定义基础属性分别汇总，反复读取不会叠加。
      stats = calculateCombatStats(stats, item.additionalStats)
    }
    for (const skill of this.skills) {
      if (skill.type === 'passive') stats = calculateCombatStats(stats, skill.passiveStats)
    }
    return stats
  }

  /** 先核对归属，再检查等级与职业；失败不会移动物品或修改属性。 */
  checkEquip(itemId: string): EquipCheck {
    const item = this.items.find((entry) => entry.id === itemId)
    if (!item) return { canEquip: false, reason: 'not-in-bag' }
    if (!item.equipment) return { canEquip: false, reason: 'not-equipment' }
    const requirements = item.equipment.requirements
    if (this.level < requirements.level) return { canEquip: false, reason: 'level' }
    if (requirements.classes.length > 0 && !requirements.classes.includes(this.characterClass)) {
      return { canEquip: false, reason: 'class' }
    }
    return { canEquip: true, reason: undefined }
  }

  /** 只允许穿戴符合条件的背包装备；替换时旧装备原实例回包。 */
  equip(itemId: string): EquipCheck {
    const check = this.checkEquip(itemId)
    if (!check.canEquip) return check
    const item = this.items.find((entry) => entry.id === itemId)!
    const equipment = item.equipment!
    const previous = this.equippedItems.get(equipment.slot)
    this.inventory.remove(itemId, 1)
    // 穿戴已释放一格，旧装备能够原实例回包，即使替换前背包已满。
    if (previous) this.inventory.receive(previous)
    this.equippedItems.set(equipment.slot, item)
    this.clampVitalsToStats()
    return check
  }

  /** 满包时保留原穿戴状态，避免卸装丢失或绕过三十格容量。 */
  unequip(slot: EquipmentSlot): boolean {
    const item = this.equippedItems.get(slot)
    if (!item || this.items.length === this.inventory.capacity) return false
    this.equippedItems.delete(slot)
    this.inventory.receive(item)
    this.clampVitalsToStats()
    return true
  }

  /** 背包占用以核心实际堆叠格数为准。 */
  get inventoryCapacity(): number { return this.inventory.capacity }

  /** 无法入包的掉落独立保留，不会自动领取或过期。 */
  get pendingItems(): readonly Item[] { return this.inventory.pendingItems }

  /** 手动领取待领掉落，剩余数量由背包继续保管。 */
  claimItem(itemId: string): ReceiveItemResult { return this.inventory.claim(itemId) }

  /** 页面完成数量确认后丢弃指定格中的物品，不影响已穿戴装备。 */
  discardItem(itemId: string, quantity: number): boolean { return this.inventory.remove(itemId, quantity) }

  /** 小生命药水仅限存活且未满血时使用；复用即时效果并在成功后扣一瓶。 */
  useItem(itemId: string): EffectResult | undefined {
    const item = this.items.find((entry) => entry.id === itemId)
    if (!item?.effect || !this.isAlive || this.health === this.stats.maxHealth) return undefined
    const result = new Effect(item.effect).apply(this, this)
    this.inventory.remove(itemId, 1)
    return result
  }

  /** 战斗胜利结算时发放经验，结算次数由单场战斗协调器保证。 */
  gainExperience(amount: number): ExperienceGainResult {
    const previousLevel = this.level
    this.experienceValue += amount
    this.levelExperienceValue += amount
    // 一次奖励可以跨越多级；满级后保留剩余经验，但不继续消耗或增加等级。
    while (this.level < this.growth.maxLevel) {
      const required = this.growth.experienceToNextLevel[this.level - 1]
      if (this.levelExperienceValue < required) break
      this.levelExperienceValue -= required
      this.levelValue += 1
    }
    if (this.level !== previousLevel) {
      // 已确认的升级奖励：按含装备的最新上限回满生命和魔法。
      this.restoreHealth(this.stats.maxHealth)
      this.restoreMana(this.stats.maxMana)
    }
    return { previousLevel, level: this.level }
  }

  /** 接收已经创建的独立掉落实例，使界面展示真实获得的物品。 */
  receiveItem(item: Item): ReceiveItemResult {
    return this.inventory.receive(item)
  }
}
