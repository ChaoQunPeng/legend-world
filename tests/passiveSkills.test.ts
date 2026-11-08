import assert from 'node:assert/strict'
import { test } from 'node:test'
import { Battle, Character, CombatSession, Item } from '../src/core'
import { createLocalWorld } from '../src/game/data/localWorld'
import { localSkills } from '../src/game/data/localSkills'
import { warriorGrowth } from '../src/game/data/localGrowth'
import { readSkillBook } from '../src/game/panels/skills'
import { createGameStore } from '../src/stores/gameStore'

test('强健体魄一级可免费学习，只增加二十生命上限，不恢复当前资源', () => {
  const { character } = createLocalWorld()
  character.takeDamage(10)
  character.consumeMana(5)
  const items = character.items
  assert.equal(character.stats.maxHealth, 120)
  assert.equal(character.learnSkill('strong-body').success, true)
  assert.equal(character.stats.maxHealth, 140)
  assert.equal(character.health, 110)
  assert.equal(character.mana, 25)
  assert.equal(character.experience, 0)
  assert.deepEqual(character.items, items)
  assert.equal(character.skills.find((skill) => skill.id === 'strong-body')!.level, 1)
  assert.deepEqual(character.learnedSkillIds, ['heavy-strike', 'strong-body'])
})

test('重复学习和反复查询不累加被动，其他角色实例与静态定义不受影响', () => {
  const first = createLocalWorld().character
  const second = createLocalWorld().character
  first.learnSkill('strong-body')
  for (let index = 0; index < 5; index += 1) {
    assert.deepEqual(first.learnSkill('strong-body'), { success: false, reason: 'already-learned' })
    readSkillBook(first)
    assert.equal(first.stats.maxHealth, 140)
    assert.equal(first.health, 120)
  }
  assert.equal(second.stats.maxHealth, 120)
  assert.equal(second.learnedSkillIds.includes('strong-body'), false)
  assert.equal(localSkills.strongBody.stats.maxHealth, 20)
})

test('被动与装备及等级成长分别汇总，穿脱不重复叠加也不恢复生命', () => {
  const { character } = createLocalWorld()
  const armor = new Item('passive-armor', {
    id: 'passive-armor', name: '生命护甲', type: 'equipment', quality: 'normal',
    equipment: { slot: 'armor', stats: { maxHealth: 10 }, requirements: { level: 1, classes: [] } },
  })
  character.receiveItem(armor)
  character.equip(armor.id)
  character.learnSkill('strong-body')
  assert.equal(character.stats.maxHealth, 150)
  assert.equal(character.health, 120)
  character.gainExperience(20)
  assert.equal(character.stats.maxHealth, 162)
  assert.equal(character.health, 162, '升级按含装备和被动的最终上限回满')
  character.unequip('armor')
  assert.equal(character.stats.maxHealth, 152)
  assert.equal(character.health, 152)
  character.equip(armor.id)
  assert.equal(character.stats.maxHealth, 162)
  assert.equal(character.health, 152)
  assert.equal(character.stats.maxHealth, 162)
})

test('战斗中拒绝学习被动，战斗结束后学习只改变新的生命上限', () => {
  const world = createLocalWorld()
  const game = createGameStore(world, () => 0, () => 0.99)
  game.store.getState().startBattle()
  game.store.getState().stopBattle()
  game.store.getState().learnSkill('strong-body')
  assert.equal(world.character.stats.maxHealth, 120)
  assert.equal(game.store.getState().skillBook.entries.at(-1)!.unavailableReason, '战斗中不可学习')
  game.advanceTo(60000)
  assert.equal(world.character.health, 132)
  game.store.getState().learnSkill('strong-body')
  assert.equal(world.character.stats.maxHealth, 152)
  assert.equal(world.character.health, 132)
})

test('已学被动不能主动释放，只有被动时仍普通攻击且不耗魔法', () => {
  const world = createLocalWorld()
  const character = new Character({
    id: 'passive-only', name: '被动验证战士', characterClass: 'warrior', level: 1,
    stats: world.character.levelStats, growth: warriorGrowth,
    skills: [{ skill: localSkills.strongBody, requiredLevel: 1, characterClass: 'warrior' }],
    learnedSkillIds: ['strong-body'],
  })
  assert.equal(character.health, 140, '直接创建已学被动的角色仍以最终属性满状态开始')
  const battle = new Battle(() => 0.99)
  const passive = character.skills[0]
  assert.deepEqual(battle.castSkill(character, world.monster, passive, 1000), { success: false, reason: 'passiveSkill' })
  assert.equal(character.mana, 30)
  assert.equal(world.monster.health, 80)
  assert.equal(battle.getRemainingCooldown(character, passive, 1000), 0)
  const session = new CombatSession(character, world.monster, () => 0.99)
  session.start()
  session.advanceTo(1000)
  const attack = session.records.find((record) => record.type === 'damage' && record.attackerId === character.id)
  assert.equal(attack?.type, 'damage')
  if (attack?.type === 'damage') {
    assert.equal(attack.actionName, '普通攻击')
    assert.equal(attack.damage, 12)
  }
  assert.equal(character.mana, 30)
  assert.equal(character.health, 134)
})

test('主动释放顺序和行动数不受已学被动影响', () => {
  /** 同一战斗分别学与不学被动，只比较学习后四次行动点的记录。 */
  function play(learnPassive: boolean) {
    const world = createLocalWorld()
    if (learnPassive) world.character.learnSkill('strong-body')
    const session = new CombatSession(world.character, world.monster, () => 0.99)
    session.start()
    session.advanceTo(4000)
    return session.records
  }
  assert.deepEqual(play(true), play(false))
})

test('页面区分被动与主动，学习后血条、等级和药水可用状态同步', () => {
  const world = createLocalWorld()
  const game = createGameStore(world, () => 0, () => 0.99)
  const initial = game.store.getState().skillBook.entries.at(-1)!
  assert.equal(initial.type, 'passive')
  assert.equal(initial.canLearn, true)
  assert.equal(initial.priority, undefined)
  assert.equal(initial.manaCost, undefined)
  assert.equal(initial.cooldownSeconds, undefined)
  assert.deepEqual(initial.effects, ['生命上限 +20'])
  assert.deepEqual(game.store.getState().skillBook.entries.slice(0, 4).map((skill) => skill.priority), [1, 2, 3, 4])
  game.store.getState().learnSkill('strong-body')
  const state = game.store.getState()
  assert.equal(state.character.stats.maxHealth, 140)
  assert.equal(state.character.health, 120)
  assert.equal(state.skillBook.learnedCount, 2)
  assert.equal(state.skillBook.entries.at(-1)!.level, 1)
  const potion = state.inventory.items.find((item) => item.type === 'consumable')!
  assert.equal(potion.canUse, true)
  game.store.getState().useItem(potion.id)
  assert.equal(world.character.health, 140)
  assert.equal(world.character.items.find((item) => item.id === potion.id)!.quantity, 4)
  assert.match(game.store.getState().inventoryMessage, /恢复 20 生命/)
})
