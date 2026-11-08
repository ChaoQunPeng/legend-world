import { Character, Item, Monster } from '../../core'
import type { CharacterOptions, ItemDefinition, MonsterDefinition } from '../../core'
import { localSkills } from './localSkills'
import { warriorGrowth } from './localGrowth'

/** 本地初始角色配置，使用现有战士职业与基础战斗属性。 */
const characterOptions: CharacterOptions = {
  id: 'local-character-1',
  name: '初行者',
  characterClass: 'warrior',
  level: 1,
  growth: warriorGrowth,
  // 技能目录只定义学习条件与释放优先级，初始仅学会重击。
  skills: [
    { skill: localSkills.heavyStrike, requiredLevel: 1, characterClass: 'warrior' },
    { skill: localSkills.powerStrike, requiredLevel: 3, characterClass: 'warrior' },
    { skill: localSkills.selfHeal, requiredLevel: 5, characterClass: 'warrior' },
    { skill: localSkills.drainingStrike, requiredLevel: 8, characterClass: 'warrior' },
    { skill: localSkills.strongBody, requiredLevel: 1, characterClass: 'warrior' },
  ],
  learnedSkillIds: [localSkills.heavyStrike.id],
  stats: {
    maxHealth: 120,
    maxMana: 30,
    attack: 18,
    defense: 10,
    magicAttack: 3,
    magicDefense: 5,
    hitRate: 1,
  },
}

/** 本地体验物品：同部位武器便于查看替换，材料与战斗掉落统一进入背包。 */
export const starterItems: readonly ItemDefinition[] = [
  { id: 'wood-sword', name: '木剑', type: 'equipment', quality: 'normal', equipment: { requirements: { level: 1, classes: [] }, slot: 'weapon', stats: { attack: 3 } } },
  { id: 'iron-sword', name: '精铁剑', type: 'equipment', quality: 'uncommon', equipment: { requirements: { level: 2, classes: [] }, slot: 'weapon', stats: { attack: 7 } } },
  { id: 'cloth-helmet', name: '布帽', type: 'equipment', quality: 'normal', equipment: { requirements: { level: 1, classes: [] }, slot: 'helmet', stats: { defense: 1 } } },
  { id: 'cloth-armor', name: '布衣', type: 'equipment', quality: 'normal', equipment: { requirements: { level: 1, classes: [] }, slot: 'armor', stats: { defense: 3 } } },
  { id: 'cloth-boots', name: '布靴', type: 'equipment', quality: 'normal', equipment: { requirements: { level: 1, classes: [] }, slot: 'boots', stats: { defense: 1 } } },
  { id: 'copper-necklace', name: '铜项链', type: 'equipment', quality: 'uncommon', equipment: { requirements: { level: 1, classes: [] }, slot: 'necklace', stats: { magicDefense: 2 } } },
  { id: 'copper-ring', name: '铜戒指', type: 'equipment', quality: 'normal', equipment: { requirements: { level: 1, classes: [] }, slot: 'ring', stats: { attack: 1 } } },
  { id: 'iron-ore', name: '铁矿石', type: 'material', quality: 'normal', maxStack: 99 },
  { id: 'iron-ore', name: '铁矿石', type: 'material', quality: 'normal', maxStack: 99 },
  { id: 'small-health-potion', name: '小生命药水', type: 'consumable', quality: 'normal', maxStack: 20, effect: { type: 'heal', target: 'self', amount: 50 } },
  { id: 'leather', name: '皮革', type: 'material', quality: 'normal', maxStack: 99 },
]

/** 野狼的静态定义，与具体怪物实例的当前生命、魔法分开保存。 */
export const wolfDefinition: MonsterDefinition = {
  id: 'wild-wolf',
  name: '野狼',
  rank: 'normal',
  level: 1,
  // 零耗魔的撕咬可由无魔法野狼使用，列表顺序决定怪物释放优先级。
  skills: [localSkills.wolfBite],
  stats: {
    maxHealth: 80,
    maxMana: 0,
    attack: 12,
    defense: 6,
    magicAttack: 0,
    magicDefense: 2,
    hitRate: 1,
  },
  rewards: {
    experience: 20,
    drops: [
      { item: { id: 'wolf-fang', name: '狼牙', type: 'material', quality: 'normal', maxStack: 99 }, probability: 1 },
      { item: starterItems[0], probability: 0.3 },
      { item: starterItems[1], probability: 0.1 },
    ],
  },
}

/** 页面与场景共用的本地单位，避免各自创建不同的战斗实例。 */
export interface LocalWorld {
  character: Character
  monster: Monster
  /** 每次刷新从静态定义创建新实例，场次同时区分怪物和掉落 ID。 */
  createMonster: (battleNumber: number) => Monster
}

/** 每次进入页面创建独立的满状态单位；当前阶段不接入存档或远端接口。 */
export function createLocalWorld(): LocalWorld {
  const character = new Character(characterOptions)
  for (const [index, definition] of starterItems.entries()) {
    character.receiveItem(new Item(`starter-${index}`, definition, definition.type === 'consumable' ? 5 : 1))
  }
  return {
    character,
    monster: createLocalMonster(1),
    createMonster: createLocalMonster,
  }
}

/** 单个本地世界内按场次生成唯一怪物，生命、魔法和技能实例均重新创建。 */
function createLocalMonster(battleNumber: number): Monster {
  return new Monster(`local-monster-${battleNumber}`, wolfDefinition)
}
