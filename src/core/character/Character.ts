import { Combatant } from '../combat/Combatant'
import type { CombatantOptions } from '../combat/Combatant'
import type { EquipmentSlot, Item } from '../item/Item'
import { calculateCombatStats } from '../combat/stats'
import type { CombatStats } from '../combat/Combatant'

/** 第一阶段支持的角色职业。 */
export type CharacterClass = 'warrior' | 'mage' | 'taoist'

/** 初始角色数据；职业配置提供属性，等级成长规则后续单独实现。 */
export interface CharacterOptions extends CombatantOptions {
  characterClass: CharacterClass
  level: number
}

/** 玩家角色负责身份、背包与穿戴；共用战斗状态由 Combatant 维护。 */
export class Character extends Combatant {
  readonly characterClass: CharacterClass
  readonly level: number
  private experienceValue = 0
  private readonly obtainedItems: Item[] = []
  private readonly equippedItems = new Map<EquipmentSlot, Item>()

  /** 根据已选职业的初始配置创建角色。 */
  constructor(options: CharacterOptions) {
    super(options)
    this.characterClass = options.characterClass
    this.level = options.level
  }

  /** 当前只累计经验，等级曲线和升级属性在后续成长任务中实现。 */
  get experience(): number {
    return this.experienceValue
  }

  /** 返回背包中未穿戴的物品快照，装备栏单独保存已穿戴实例。 */
  get items(): readonly Item[] {
    return [...this.obtainedItems]
  }

  /** 装备栏返回独立快照，外部只能通过穿脱方法改变物品归属。 */
  get equipment(): ReadonlyMap<EquipmentSlot, Item> {
    return new Map(this.equippedItems)
  }

  /** 每件已穿戴装备依次叠加，面板和伤害公式读取同一份最终属性。 */
  override get stats(): Readonly<CombatStats> {
    let stats = super.stats
    for (const item of this.equippedItems.values()) {
      stats = calculateCombatStats(stats, item.equipment!.stats)
    }
    return stats
  }

  /** 只允许穿戴背包中的装备；同部位旧装备自动回包，不复制或销毁物品。 */
  equip(itemId: string): void {
    const index = this.obtainedItems.findIndex((item) => item.id === itemId)
    const item = this.obtainedItems[index]
    // 背包可包含材料，且已穿戴物品不在背包内，这两种情况不能再次穿戴。
    if (!item?.equipment) return
    const previous = this.equippedItems.get(item.equipment.slot)
    this.obtainedItems.splice(index, 1)
    if (previous) this.obtainedItems.push(previous)
    this.equippedItems.set(item.equipment.slot, item)
    this.clampVitalsToStats()
  }

  /** 空部位无需处理；卸下的装备回到背包，属性立即重新计算。 */
  unequip(slot: EquipmentSlot): void {
    const item = this.equippedItems.get(slot)
    if (!item) return
    this.equippedItems.delete(slot)
    this.obtainedItems.push(item)
    this.clampVitalsToStats()
  }

  /** 战斗胜利结算时发放经验，结算次数由单场战斗协调器保证。 */
  gainExperience(amount: number): void {
    this.experienceValue += amount
  }

  /** 接收已经创建的独立掉落实例，使界面展示真实获得的物品。 */
  receiveItem(item: Item): void {
    this.obtainedItems.push(item)
  }
}
