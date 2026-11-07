import type { Character, CharacterClass, Combatant, CombatStats, Monster, MonsterRank } from '../../core'

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
  readonly fields: readonly InfoField[]
}

/** 临时 UI 的展示字段，由面板逻辑统一提供名称和数值。 */
export interface InfoField {
  readonly label: string
  readonly value: string | number
}

const classLabels: Record<CharacterClass, string> = { warrior: '战士', mage: '法师', taoist: '道士' }
const rankLabels: Record<MonsterRank, string> = { normal: '普通', elite: '精英', boss: '首领' }

/** 统一角色、怪物的实时状态与最终属性口径，查看不会修改战斗对象。 */
function readUnitInfo(unit: Combatant, category: string, detail: string): UnitInfo {
  const stats = unit.stats
  return {
    id: unit.id, name: unit.name, category, detail,
    health: unit.health, mana: unit.mana, isAlive: unit.isAlive, stats,
    fields: [
      { label: '名称', value: unit.name },
      { label: '状态', value: unit.isAlive ? '存活' : '已倒下' },
      { label: '生命', value: `${unit.health} / ${stats.maxHealth}` },
      { label: '魔法', value: `${unit.mana} / ${stats.maxMana}` },
      { label: '物理攻击', value: stats.attack },
      { label: '物理防御', value: stats.defense },
      { label: '魔法攻击', value: stats.magicAttack },
      { label: '魔法防御', value: stats.magicDefense },
    ],
  }
}

/** 角色基础信息包含身份、等级、职业和已累计经验，不推导尚未实现的升级进度。 */
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
      ...info.fields,
    ],
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
      { label: '击杀经验', value: monster.rewards.experience },
      { label: '固定掉落', value: monster.rewards.drops.length === 0 ? '无' : monster.rewards.drops.map((item) => `${item.name} × 1`).join('、') },
    ],
  }
}
