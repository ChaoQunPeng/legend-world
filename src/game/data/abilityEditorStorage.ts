import type { CombatStats, EffectDefinition, SkillDefinition } from '../../core'
import { localEffects } from './localEffects'
import { localSkills } from './localSkills'

/** 效果核心没有 ID 和名称，编辑器在外层维护目录信息，执行定义保持原样。 */
export interface EffectEntry { id: string; name: string; definition: EffectDefinition }
/** 技能与效果共用一份配置文件，便于完整备份和跨页面选择。 */
export interface AbilityDocument { version: 1; skills: SkillDefinition[]; effects: EffectEntry[] }
const storageKey = 'legend-world.abilities.v1'
export const abilityStatLabels: Record<keyof CombatStats, string> = {
  maxHealth: '生命上限', maxMana: '魔法上限', attack: '物理攻击', defense: '物理防御',
  magicAttack: '魔法攻击', magicDefense: '魔法防御', hitRate: '命中率加成',
}
export const effectTypeLabels = { physicalDamage: '物理伤害', damage: '固定伤害', heal: '恢复生命', restoreMana: '恢复魔法' }

/** 初始目录复制项目现有定义，编辑操作不会改变游戏中的静态配置。 */
export function createAbilityDocument(): AbilityDocument {
  return structuredClone({ version: 1, skills: Object.values(localSkills), effects: Object.entries(localEffects).map(([id, definition]) => ({ id, name: id, definition })) })
}

/** 导入文件是外部输入，按核心支持的效果类型检查数值与目标。 */
function validateEffect(effect: EffectDefinition) {
  if (!effect || (effect.description !== undefined && typeof effect.description !== 'string') || !Object.hasOwn(effectTypeLabels, effect.type)
    || !['self', 'target'].includes(effect.target)
    || (effect.type === 'physicalDamage' && (effect.target !== 'target' || !Number.isFinite(effect.attackBonus) || effect.attackBonus < 0))
    || (effect.type !== 'physicalDamage' && (!Number.isFinite(effect.amount) || effect.amount < 0))) {
    throw new Error('效果类型、目标或非负数值不正确。')
  }
}

/** 保存与导入共用校验，禁止重复目录 ID 和不符合现有核心契约的数据。 */
export function parseAbilityDocument(json: string): AbilityDocument {
  const document = JSON.parse(json) as AbilityDocument
  if (!document || document.version !== 1 || !Array.isArray(document.skills) || !Array.isArray(document.effects)
    || document.skills.length === 0 || document.effects.length === 0) throw new Error('请选择版本 1 的技能效果配置，两个目录均需保留至少一条。')
  for (const entries of [document.skills, document.effects]) {
    const ids = new Set<string>()
    for (const entry of entries) {
      if (!entry || typeof entry.id !== 'string' || !entry.id.trim() || typeof entry.name !== 'string' || !entry.name.trim() || ids.has(entry.id)) throw new Error('ID 和名称不能为空，且同一目录 ID 不可重复。')
      ids.add(entry.id)
    }
  }
  for (const entry of document.effects) validateEffect(entry.definition)
  for (const skill of document.skills) {
    // 说明字段可缺省以兼容旧文件；存在时必须是玩家可展示的纯文本。
    if (skill.description !== undefined && typeof skill.description !== 'string') throw new Error('技能说明必须是文本。')
    if (skill.type === 'active') {
      if (!Number.isFinite(skill.manaCost) || skill.manaCost < 0 || !Number.isFinite(skill.cooldownMs) || skill.cooldownMs < 0 || !Array.isArray(skill.effects)) throw new Error('主动技能耗魔和冷却必须为非负数。')
      skill.effects.forEach(validateEffect)
    } else if (skill.type === 'passive') {
      if (!skill.stats || Object.entries(skill.stats).some(([key, value]) => !Object.hasOwn(abilityStatLabels, key) || !Number.isFinite(value))) throw new Error('被动技能属性配置不正确。')
    } else throw new Error('技能类型不正确。')
  }
  return document
}

/** 浏览器没有保存记录时读取项目模板，损坏数据交给页面提示。 */
export function loadAbilityDocument(): AbilityDocument {
  const json = localStorage.getItem(storageKey)
  return json === null ? createAbilityDocument() : parseAbilityDocument(json)
}

/** 用户确认保存后一次写入两个目录，关联数据按当前快照持久化。 */
export function saveAbilityDocument(document: AbilityDocument) {
  localStorage.setItem(storageKey, JSON.stringify(document))
}
