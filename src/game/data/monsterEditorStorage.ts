import type { MonsterDefinition } from '../../core'
import { wolfDefinition } from './localWorld'

const storageKey = 'legend-world.monster-editor.v1'

/** 编辑器沿用核心怪物定义，保存整份配置以保留技能效果和已有掉落数据。 */
export interface MonsterEditorDocument {
  version: 1
  monsters: MonsterDefinition[]
}

/** 首次使用以游戏内的野狼为模板，复制后编辑不会改动运行中的游戏。 */
export function createMonsterDocument(): MonsterEditorDocument {
  return { version: 1, monsters: [structuredClone(wolfDefinition)] }
}

/** JSON 文件和浏览器存储是外部输入；拒绝格式不符的数据，避免覆盖当前编辑内容。 */
export function parseMonsterDocument(json: string): MonsterEditorDocument {
  const document = JSON.parse(json) as MonsterEditorDocument
  if (document.version !== 1 || !Array.isArray(document.monsters) || document.monsters.length === 0) {
    throw new Error('请选择包含怪物列表的版本 1 配置文件。')
  }
  const ids = new Set<string>()
  for (const monster of document.monsters) {
    if (!monster || typeof monster.id !== 'string' || !monster.id.trim() || typeof monster.name !== 'string' || !monster.name.trim()
      || !['normal', 'elite', 'boss'].includes(monster.rank) || !Number.isInteger(monster.level) || monster.level < 1
      || !monster.stats || !Array.isArray(monster.skills) || !monster.rewards || !Array.isArray(monster.rewards.drops)
      || !Number.isFinite(monster.rewards.experience) || monster.rewards.experience < 0 || ids.has(monster.id)) {
      throw new Error('怪物基本信息格式错误或 ID 重复。')
    }
    for (const key of ['maxHealth', 'maxMana', 'attack', 'defense', 'magicAttack', 'magicDefense', 'hitRate'] as const) {
      const value = monster.stats[key]
      if (!Number.isFinite(value) || value < 0 || (key === 'maxHealth' && value < 1) || (key === 'hitRate' && value > 1)) {
        throw new Error(`${monster.name} 的属性 ${key} 不符合范围。`)
      }
    }
    for (const skill of monster.skills) {
      if (!skill || typeof skill.id !== 'string' || typeof skill.name !== 'string'
        || (skill.type !== 'active' && skill.type !== 'passive')
        || (skill.type === 'active' && (!Array.isArray(skill.effects) || !Number.isFinite(skill.cooldownMs) || !Number.isFinite(skill.manaCost)))
        || (skill.type === 'passive' && !skill.stats)) {
        throw new Error(`${monster.name} 的技能配置格式错误。`)
      }
    }
    ids.add(monster.id)
  }
  return document
}

/** 未保存过配置时使用项目模板；存储损坏、隐私模式限制等错误交由页面明确提示。 */
export function loadMonsterDocument(): MonsterEditorDocument {
  const json = localStorage.getItem(storageKey)
  return json === null ? createMonsterDocument() : parseMonsterDocument(json)
}

/** 只有点击保存才写入浏览器，避免草稿操作覆盖已确认的配置。 */
export function saveMonsterDocument(document: MonsterEditorDocument): void {
  localStorage.setItem(storageKey, JSON.stringify(document))
}
