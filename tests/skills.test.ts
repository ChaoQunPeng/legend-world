import assert from 'node:assert/strict'
import { test } from 'node:test'
import { Battle, Character, CombatSession, Monster, Skill } from '../src/core'
import type { CharacterSkillDefinition } from '../src/core'
import { createLocalWorld } from '../src/game/data/localWorld'
import { localSkills } from '../src/game/data/localSkills'
import { warriorGrowth } from '../src/game/data/localGrowth'
import { readSkillBook } from '../src/game/panels/skills'
import { createGameStore } from '../src/stores/gameStore'

/** 直接按指定等级创建角色，学习测试不需要额外发奖或改动正式页面数据。 */
function createCharacter(level = 1, catalog: readonly CharacterSkillDefinition[] = createLocalWorld().character.skillCatalog, learnedSkillIds: readonly string[] = ['heavy-strike']) {
  return new Character({
    id: 'skill-character', name: '技能验证战士', characterClass: 'warrior', level,
    stats: createLocalWorld().character.levelStats, growth: warriorGrowth,
    skills: catalog, learnedSkillIds,
  })
}

/** 用高生命目标覆盖多次行动，避免技能策略验证在第一击提前结束。 */
function createTarget(attack = 0, skills = [localSkills.heavyStrike]) {
  return new Monster('skill-target', {
    id: 'skill-target', name: '技能验证目标', level: 1, rank: 'normal', skills,
    stats: { maxHealth: 1000, maxMana: 50, attack, defense: 6, magicAttack: 0, magicDefense: 0, hitRate: 1 },
    rewards: { experience: 20, drops: [] },
  })
}

test('初始只学会重击，获得经验不会自动学习目录中的其他技能', () => {
  const { character } = createLocalWorld()
  assert.equal(character.skillCatalog.length, 5)
  assert.deepEqual(character.learnedSkillIds, ['heavy-strike'])
  assert.equal(character.skills[0].level, 1)
  assert.equal(readSkillBook(character).entries[0].level, 1)
  assert.equal(readSkillBook(character).entries[1].level, undefined)
  character.gainExperience(560)
  assert.equal(character.level, 8)
  assert.deepEqual(character.learnedSkillIds, ['heavy-strike'])
  assert.equal(readSkillBook(character).learnedCount, 1)
  assert.equal(readSkillBook(character).entries.filter((skill) => skill.canLearn).length, 4)
})

test('3、5、8 级条件分别生效，达到等级才允许手动学习且不消耗资源', () => {
  for (const [id, level] of [['power-strike', 3], ['self-heal', 5], ['draining-strike', 8]] as const) {
    const character = createCharacter(level - 1)
    assert.deepEqual(character.learnSkill(id), { success: false, reason: 'level' })
    character.gainExperience(20 * (level - 1))
    const before = { experience: character.experience, levelExperience: character.levelExperience, health: character.health, mana: character.mana, items: character.items }
    assert.equal(character.learnSkill(id).success, true)
    assert.ok(character.learnedSkillIds.includes(id))
    assert.equal(character.skills.find((skill) => skill.id === id)!.level, 1)
    assert.deepEqual({ experience: character.experience, levelExperience: character.levelExperience, health: character.health, mana: character.mana, items: character.items }, before)
    assert.deepEqual(character.learnSkill(id), { success: false, reason: 'already-learned' })
    assert.equal(character.learnedSkillIds.filter((value) => value === id).length, 1)
  }
})

test('未知技能和其他职业技能不能学习，也不会加入已学记录', () => {
  const character = createCharacter(8, [
    { skill: localSkills.heavyStrike, characterClass: 'warrior', requiredLevel: 1 },
    { skill: localSkills.powerStrike, characterClass: 'mage', requiredLevel: 1 },
  ])
  assert.deepEqual(character.learnSkill('unknown'), { success: false, reason: 'unknown-skill' })
  assert.deepEqual(character.learnSkill('power-strike'), { success: false, reason: 'class' })
  assert.deepEqual(character.learnedSkillIds, ['heavy-strike'])
})

test('战斗中核心禁止学习，胜利后解锁；另一场战斗不能同时占用同一角色', () => {
  const character = createCharacter(8)
  const session = new CombatSession(character, createLocalWorld().monster, () => 0.99)
  assert.equal(session.start(), true)
  assert.equal(character.isInCombat, true)
  assert.equal(new CombatSession(character, createLocalWorld().monster, () => 0.99).start(), false)
  assert.deepEqual(character.learnSkill('power-strike'), { success: false, reason: 'in-combat' })
  assert.deepEqual(character.learnedSkillIds, ['heavy-strike'])
  session.advanceTo(60000)
  assert.equal(session.status, 'victory')
  assert.equal(character.isInCombat, false)
  assert.equal(character.learnSkill('power-strike').success, true)
})

test('战败结束同样解除学习限制，死亡不会使技能自动学习', () => {
  const character = createCharacter(3)
  const session = new CombatSession(character, createTarget(999, []), () => 0.99)
  session.start()
  session.advanceTo(1000)
  assert.equal(session.status, 'defeat')
  assert.equal(character.isInCombat, false)
  assert.deepEqual(character.learnedSkillIds, ['heavy-strike'])
  assert.equal(character.checkLearnSkill('power-strike').success, true)
})

test('直接释放未学技能被拒绝，不扣魔法、不启动冷却、不伤害目标', () => {
  const character = createCharacter(3)
  const target = createTarget()
  const battle = new Battle(() => 0.99)
  const unlearned = new Skill(localSkills.powerStrike)
  const mana = character.mana
  assert.deepEqual(battle.castSkill(character, target, unlearned, 1000), { success: false, reason: 'skillNotLearned' })
  assert.equal(character.mana, mana)
  assert.equal(target.health, 1000)
  assert.equal(battle.getRemainingCooldown(character, unlearned, 1000), 0)
  character.learnSkill(unlearned.id)
  const learned = character.skills.find((skill) => skill.id === unlearned.id)!
  assert.equal(battle.castSkill(character, target, learned, 1000).success, true)
  assert.equal(character.mana, mana - 5)
  assert.equal(target.health, 974)
})

test('逆序学习仍按目录优先级提供技能，重复查询不改变记录', () => {
  const character = createCharacter(8)
  for (const id of ['draining-strike', 'self-heal', 'power-strike']) character.learnSkill(id)
  assert.deepEqual(character.skills.map((skill) => skill.id), ['heavy-strike', 'power-strike', 'self-heal', 'draining-strike'])
  readSkillBook(character)
  assert.deepEqual(character.learnedSkillIds, ['heavy-strike', 'power-strike', 'self-heal', 'draining-strike'])
})

test('自动战斗只尝试已学技能，冷却期间尝试下一项或回退普攻', () => {
  const catalog: readonly CharacterSkillDefinition[] = [
    { skill: { ...localSkills.heavyStrike, cooldownMs: 3000 }, requiredLevel: 1, characterClass: 'warrior' },
    { skill: { ...localSkills.powerStrike, cooldownMs: 3000 }, requiredLevel: 1, characterClass: 'warrior' },
  ]
  /** 同一目录分别只学重击和学习两项，对比冷却回退行为。 */
  function actions(learnPower: boolean) {
    const character = createCharacter(1, catalog)
    if (learnPower) character.learnSkill('power-strike')
    const session = new CombatSession(character, createTarget(0, []), () => 0.99)
    session.start()
    session.advanceTo(4000)
    return session.records.filter((record) => record.type === 'damage' && record.attackerId === character.id).map((record) => record.actionName)
  }
  assert.deepEqual(actions(false), ['重击', '普通攻击', '普通攻击', '重击'])
  assert.deepEqual(actions(true), ['重击', '强力一击', '普通攻击', '重击'])
})

test('没有已学技能或魔法不足时都可以正常普通攻击', () => {
  for (const noLearned of [true, false]) {
    const character = createCharacter(1, createLocalWorld().character.skillCatalog, noLearned ? [] : ['heavy-strike'])
    if (!noLearned) character.consumeMana(character.mana)
    const session = new CombatSession(character, createTarget(0, []), () => 0.99)
    session.start()
    session.advanceTo(1000)
    const action = session.records.find((record) => record.type === 'damage' && record.attackerId === character.id)
    assert.equal(action?.type, 'damage')
    if (action?.type === 'damage') assert.equal(action.actionName, '普通攻击')
  }
})

test('同一配置创建的角色技能和怪物技能正常释放，双方冷却互不干扰', () => {
  const first = createCharacter()
  const second = createCharacter()
  const target = createTarget()
  const battle = new Battle(() => 0.99)
  assert.equal(battle.castSkill(first, target, first.skills[0], 1000).success, true)
  assert.equal(battle.castSkill(second, target, second.skills[0], 1000).success, true)
  assert.equal(battle.castSkill(target, first, target.skills[0], 1000).success, true)
  assert.deepEqual(battle.castSkill(first, target, first.skills[0], 1500), { success: false, reason: 'cooldown' })
  assert.equal(battle.getRemainingCooldown(first, first.skills[0], 1500), 500)
  assert.equal(battle.castSkill(first, target, first.skills[0], 2000).success, true)
})

test('技能页面快照在战前可学习、战斗中锁定、结束后恢复，失败不会更改记录', () => {
  const world = createLocalWorld()
  world.character.gainExperience(60)
  const game = createGameStore(world, () => 0, () => 0.99)
  assert.equal(game.store.getState().skillBook.entries[1].canLearn, true)
  game.store.getState().startBattle()
  game.store.getState().stopBattle()
  assert.equal(game.store.getState().skillBook.isInCombat, true)
  assert.equal(game.store.getState().skillBook.entries[1].unavailableReason, '战斗中不可学习')
  game.store.getState().learnSkill('power-strike')
  assert.match(game.store.getState().skillMessage, /战斗中不可学习/)
  assert.equal(game.store.getState().skillBook.learnedCount, 1)
  game.advanceTo(60000)
  assert.equal(game.store.getState().skillBook.entries[1].canLearn, true)
  game.store.getState().learnSkill('power-strike')
  assert.equal(game.store.getState().skillBook.learnedCount, 2)
  assert.equal(game.store.getState().skillBook.entries[1].learned, true)
  assert.equal(game.store.getState().skillBook.entries[1].unavailableReason, '已学习')
  assert.match(game.store.getState().skillMessage, /已学会强力一击/)
})
