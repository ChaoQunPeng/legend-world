import { Character, Item, Monster, Skill } from '../../core'
import type { CharacterOptions, ItemDefinition, MonsterDefinition } from '../../core'

/** 本地初始角色配置，使用现有战士职业与基础战斗属性。 */
const characterOptions: CharacterOptions = {
  id: 'local-character-1',
  name: '初行者',
  characterClass: 'warrior',
  level: 1,
  stats: {
    maxHealth: 120,
    maxMana: 30,
    attack: 18,
    defense: 10,
    magicAttack: 3,
    magicDefense: 5,
  },
}

/** 野狼的静态定义，与具体怪物实例的当前生命、魔法分开保存。 */
const wolfDefinition: MonsterDefinition = {
  id: 'wild-wolf',
  name: '野狼',
  rank: 'normal',
  level: 1,
  stats: {
    maxHealth: 80,
    maxMana: 0,
    attack: 12,
    defense: 6,
    magicAttack: 0,
    magicDefense: 2,
  },
  rewards: {
    experience: 20,
    drops: [{ id: 'wolf-fang', name: '狼牙', type: 'material', quality: 'normal' }],
  },
}

/** 本地体验物品：同部位武器便于查看替换，材料与战斗掉落统一进入背包。 */
const starterItems: readonly ItemDefinition[] = [
  { id: 'wood-sword', name: '木剑', type: 'equipment', quality: 'normal', equipment: { slot: 'weapon', stats: { attack: 3 } } },
  { id: 'iron-sword', name: '精铁剑', type: 'equipment', quality: 'uncommon', equipment: { slot: 'weapon', stats: { attack: 7 } } },
  { id: 'cloth-helmet', name: '布帽', type: 'equipment', quality: 'normal', equipment: { slot: 'helmet', stats: { defense: 1 } } },
  { id: 'cloth-armor', name: '布衣', type: 'equipment', quality: 'normal', equipment: { slot: 'armor', stats: { defense: 3 } } },
  { id: 'cloth-boots', name: '布靴', type: 'equipment', quality: 'normal', equipment: { slot: 'boots', stats: { defense: 1 } } },
  { id: 'copper-necklace', name: '铜项链', type: 'equipment', quality: 'uncommon', equipment: { slot: 'necklace', stats: { magicDefense: 2 } } },
  { id: 'copper-ring', name: '铜戒指', type: 'equipment', quality: 'normal', equipment: { slot: 'ring', stats: { attack: 1 } } },
  { id: 'iron-ore', name: '铁矿石', type: 'material', quality: 'normal' },
  { id: 'iron-ore', name: '铁矿石', type: 'material', quality: 'normal' },
  { id: 'leather', name: '皮革', type: 'material', quality: 'normal' },
]

/** 页面与场景共用的本地单位，避免各自创建不同的战斗实例。 */
export interface LocalWorld {
  character: Character
  monster: Monster
  skill: Skill
}

/** 每次进入页面创建独立的满状态单位；当前阶段不接入存档或远端接口。 */
export function createLocalWorld(): LocalWorld {
  const character = new Character(characterOptions)
  for (const [index, definition] of starterItems.entries()) {
    character.receiveItem(new Item(`starter-${index}`, definition))
  }
  return {
    character,
    monster: new Monster('local-monster-1', wolfDefinition),
    // 重击只对本次最终攻击增加 6，伤害仍由公共公式减去目标最终防御。
    skill: new Skill({
      id: 'heavy-strike', name: '重击', manaCost: 5, cooldownMs: 3000,
      effects: [{ type: 'physicalDamage', target: 'target', attackBonus: 6 }],
    }),
  }
}
