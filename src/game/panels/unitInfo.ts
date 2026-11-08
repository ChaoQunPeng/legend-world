import type { Character, CharacterClass, Combatant, CombatStats, Monster, MonsterRank } from '../../core'
import { calculateHitChance } from '../../core'
import { describeEffect } from './skillDescriptions'

/** 概率以百分比展示，允许配置小数百分点，避免直接乘法产生浮点尾数。 */
export function formatPercentage(value: number): string {
  return new Intl.NumberFormat('zh-CN', { style: 'percent', maximumFractionDigits: 2 }).format(value)
}

/** 面板只读取快照，不持有可修改生命、经验或奖励的核心实例。 */
export interface UnitInfo {
  readonly id: string
  readonly name: string
  readonly category: string
  readonly detail: string
  readonly health: number
  readonly mana: number
  readonly isAlive: boolean
  readonly stats: Readonly<CombatStats>
  readonly hitChance: number
  readonly fields: readonly InfoField[]
}

/** 临时 UI 的展示字段，由面板逻辑统一提供名称和数值。 */
export interface InfoField {
  readonly label: string
  readonly value: string | number
}

export const classLabels: Record<CharacterClass, string> = { warrior: '战士', mage: '法师', taoist: '道士' }
const rankLabels: Record<MonsterRank, string> = { normal: '普通', elite: '精英', boss: '首领' }

/** 统一角色、怪物的实时状态与最终属性口径，查看不会修改战斗对象。 */
function readUnitInfo(unit: Combatant, category: string, detail: string): UnitInfo {
  const stats = unit.stats
  const hitChance = calculateHitChance(stats)
  return {
    id: unit.id, name: unit.name, category, detail,
    health: unit.health, mana: unit.mana, isAlive: unit.isAlive, stats, hitChance,
    fields: [
      { label: '名称', value: unit.name },
      { label: '状态', value: unit.isAlive ? '存活' : '已倒下' },
      { label: '生命', value: `${unit.health} / ${stats.maxHealth}` },
      { label: '魔法', value: `${unit.mana} / ${stats.maxMana}` },
      { label: '物理攻击', value: stats.attack },
      { label: '物理防御', value: stats.defense },
      { label: '魔法攻击', value: stats.magicAttack },
      { label: '魔法防御', value: stats.magicDefense },
      { label: '命中率', value: formatPercentage(hitChance) },
    ],
  }
}

/** 角色基础信息包含身份、等级、职业和经验，满级时不再展示升级目标。 */
export function readCharacterInfo(character: Character): UnitInfo {
  const profession = classLabels[character.characterClass]
  const info = readUnitInfo(character, '角色', `Lv.${character.level} · ${profession}`)
  return {
    ...info,
    fields: [
      { label: '角色 ID', value: character.id },
      { label: '职业', value: profession },
      { label: '等级', value: character.level },
      { label: '累计经验', value: character.experience },
      { label: '升级经验', value: character.experienceToNextLevel === undefined ? '已满级' : `${character.levelExperience} / ${character.experienceToNextLevel}` },
      ...info.fields,
    ],
  }
}

/** 成长面板使用独立快照，组件无需接触角色或职业配置实例。 */
export interface CharacterGrowthView {
  readonly level: number
  readonly maxLevel: number
  readonly experience: number
  readonly requiredExperience: number | undefined
  readonly increases: readonly InfoField[]
}

/** 面板与核心共用成长配置，避免页面写死升级数值。 */
export function readCharacterGrowth(character: Character): CharacterGrowthView {
  const growth = character.growth.statsPerLevel
  return {
    level: character.level, maxLevel: character.growth.maxLevel,
    experience: character.levelExperience, requiredExperience: character.experienceToNextLevel,
    increases: [
      { label: '生命上限', value: growth.maxHealth },
      { label: '魔法上限', value: growth.maxMana },
      { label: '物理攻击', value: growth.attack },
      { label: '物理防御', value: growth.defense },
      { label: '魔法攻击', value: growth.magicAttack },
      { label: '魔法防御', value: growth.magicDefense },
    ].filter((field) => field.value !== 0),
  }
}

/** 怪物基础信息区分实例与种类，奖励读取配置，查看或反复打开均不触发结算。 */
export function readMonsterInfo(monster: Monster): UnitInfo {
  const rank = rankLabels[monster.rank]
  const info = readUnitInfo(monster, '怪物', `Lv.${monster.level} · ${rank}`)
  return {
    ...info,
    fields: [
      { label: '怪物实例 ID', value: monster.id },
      { label: '怪物种类 ID', value: monster.definitionId },
      { label: '品级', value: rank },
      { label: '等级', value: monster.level },
      ...info.fields,
      { label: '技能优先级', value: monster.skillDefinitions.length === 0 ? '仅普通攻击' : monster.skillDefinitions.map((skill) => skill.name).join(' → ') },
      ...monster.skillDefinitions.map((skill): InfoField => ({
        label: `技能 · ${skill.name}`,
        value: skill.type === 'active'
          ? `耗魔 ${skill.manaCost} · 冷却 ${skill.cooldownMs / 1000} 秒 · ${skill.effects.map(describeEffect).join('；')}；冷却或魔法不足时尝试后续技能，均不可用时普攻`
          : '被动技能',
      })),
      { label: '击杀经验', value: monster.rewards.experience },
      { label: '独立掉落概率', value: monster.rewards.drops.length === 0 ? '无' : monster.rewards.drops.map(({ item, probability }) => `${item.name} × 1（${probability * 100}%）`).join('、') },
    ],
  }
}
