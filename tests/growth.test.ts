import assert from 'node:assert/strict'
import { test } from 'node:test'
import { Character, CombatSession, Item } from '../src/core'
import { createLocalWorld } from '../src/game/data/localWorld'
import { warriorGrowth } from '../src/game/data/localGrowth'
import { readCharacterGrowth } from '../src/game/panels/unitInfo'
import { createGameStore } from '../src/stores/gameStore'

/** 使用真实本地配置，在没有浏览器和时钟的环境中验证成长与奖励契约。 */
test('不足升级经验时保留进度，不改变属性或恢复资源', () => {
  const { character } = createLocalWorld()
  character.takeDamage(10)
  character.consumeMana(5)
  const before = character.stats
  assert.deepEqual(character.gainExperience(19), { previousLevel: 1, level: 1 })
  assert.equal(character.levelExperience, 19)
  assert.equal(character.experienceToNextLevel, 20)
  assert.deepEqual(character.stats, before)
  assert.equal(character.health, 110)
  assert.equal(character.mana, 25)
})

test('恰好升级时更新属性、扣除本级经验并回满资源', () => {
  const { character } = createLocalWorld()
  character.takeDamage(10)
  character.consumeMana(5)
  assert.deepEqual(character.gainExperience(20), { previousLevel: 1, level: 2 })
  assert.equal(character.experience, 20)
  assert.equal(character.levelExperience, 0)
  assert.equal(character.experienceToNextLevel, 40)
  assert.deepEqual(character.stats, { maxHealth: 132, maxMana: 32, attack: 20, defense: 11, magicAttack: 3, magicDefense: 5, hitRate: 1 })
  assert.equal(character.health, 132)
  assert.equal(character.mana, 32)
})

test('一次经验奖励支持连续升级并保留余量', () => {
  const { character } = createLocalWorld()
  assert.deepEqual(character.gainExperience(65), { previousLevel: 1, level: 3 })
  assert.equal(character.experience, 65)
  assert.equal(character.levelExperience, 5)
  assert.equal(character.experienceToNextLevel, 60)
  assert.equal(character.stats.attack, 22)
})

test('满级停止消耗经验和成长，满级后的经验不会再次触发回满', () => {
  const { character } = createLocalWorld()
  const total = warriorGrowth.experienceToNextLevel.reduce((sum, value) => sum + value, 0)
  character.gainExperience(total + 7)
  assert.equal(character.level, 60)
  assert.equal(character.levelExperience, 7)
  assert.equal(character.experienceToNextLevel, undefined)
  assert.equal(character.stats.attack, 136)
  character.takeDamage(5)
  character.gainExperience(20)
  assert.equal(character.level, 60)
  assert.equal(character.experience, total + 27)
  assert.equal(character.levelExperience, 27)
  assert.equal(character.health, character.stats.maxHealth - 5)
  assert.equal(readCharacterGrowth(character).requiredExperience, undefined)
})

test('等级成长与装备独立计算，读取与重新穿脱不会重复叠加', () => {
  const { character } = createLocalWorld()
  const armor = new Item('growth-armor', { id: 'growth-armor', name: '成长验证护甲', type: 'equipment', quality: 'normal', equipment: { requirements: { level: 1, classes: [] }, slot: 'armor', stats: { maxHealth: 10, maxMana: 4, attack: 3 } } })
  character.receiveItem(armor)
  character.equip(armor.id)
  character.gainExperience(20)
  assert.equal(character.stats.attack, 23)
  assert.equal(character.stats.attack, 23)
  assert.equal(character.health, 142)
  assert.equal(character.mana, 36)
  character.unequip('armor')
  assert.equal(character.stats.attack, 20)
  assert.equal(character.health, 132)
  assert.equal(character.mana, 32)
  character.equip(armor.id)
  assert.equal(character.stats.attack, 23)
  assert.equal(character.health, 132)
  assert.equal(character.items.filter((item) => item.id === armor.id).length, 0)
})

test('从高等级直接创建角色也以该等级满状态开始，配置不被修改', () => {
  const stats = { maxHealth: 120, maxMana: 30, attack: 18, defense: 10, magicAttack: 3, magicDefense: 5, hitRate: 1 }
  const character = new Character({ id: 'level-three', name: '高等级角色', characterClass: 'warrior', level: 3, stats, growth: warriorGrowth, skills: [], learnedSkillIds: [] })
  assert.equal(character.health, 144)
  assert.equal(character.mana, 34)
  assert.equal(stats.maxHealth, 120)
  assert.equal(warriorGrowth.statsPerLevel.maxHealth, 12)
})

test('单场击杀触发升级和掉落，重复推进不能再次奖励，页面快照同步', () => {
  const world = createLocalWorld()
  const game = createGameStore(world, () => 0, () => 0.99)
  game.store.getState().startBattle()
  game.store.getState().stopBattle()
  game.advanceTo(60000)
  const state = game.store.getState()
  assert.equal(state.battle.status, 'victory')
  assert.equal(state.growth.level, 2)
  assert.equal(state.growth.experience, 0)
  assert.equal(state.growth.requiredExperience, 40)
  assert.equal(state.character.health, 132)
  assert.equal(state.character.mana, 32)
  assert.match(state.character.detail, /Lv\.2/)
  assert.match(state.battle.logs[0].text, /升级！Lv\.1 → Lv\.2/)
  game.advanceTo(120000)
  game.store.getState().startBattle()
  game.store.getState().stopBattle()
  assert.equal(world.character.experience, 20)
  assert.equal(world.character.items.filter((item) => item.definitionId === 'wolf-fang').length, 1)
})

test('长时间推进与分段推进具有相同成长、资源和奖励记录', () => {
  const whole = createLocalWorld()
  const parts = createLocalWorld()
  const one = new CombatSession(whole.character, whole.monster, () => 0.99)
  const two = new CombatSession(parts.character, parts.monster, () => 0.99)
  one.start()
  two.start()
  one.advanceTo(60000)
  for (let time = 1000; time <= 60000; time += 1000) two.advanceTo(time)
  assert.deepEqual(one.records, two.records)
  assert.deepEqual(whole.character.stats, parts.character.stats)
  assert.equal(whole.character.levelExperience, parts.character.levelExperience)
  assert.equal(whole.character.health, parts.character.health)
  assert.equal(whole.character.mana, parts.character.mana)
})

test('战败不发放经验、不升级且没有掉落', () => {
  const world = createLocalWorld()
  world.character.takeDamage(119)
  world.character.consumeMana(30)
  const session = new CombatSession(world.character, world.monster, () => 0.99)
  session.start()
  session.advanceTo(60000)
  assert.equal(session.status, 'defeat')
  assert.equal(world.character.level, 1)
  assert.equal(world.character.experience, 0)
  assert.equal(world.character.items.filter((item) => item.definitionId === 'wolf-fang').length, 0)
  const end = session.records.at(-1)
  assert.equal(end?.type, 'end')
  if (end?.type === 'end') assert.equal(end.growth, undefined)
})
