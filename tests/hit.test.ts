import assert from 'node:assert/strict'
import { test } from 'node:test'
import { Battle, Character, CombatSession, Item, calculateHitChance, rollHit } from '../src/core'
import type { CharacterSkillDefinition } from '../src/core'
import { createLocalWorld } from '../src/game/data/localWorld'
import { readCharacterInfo } from '../src/game/panels/unitInfo'
import { readInventory } from '../src/game/panels/inventory'
import { createGameStore } from '../src/stores/gameStore'

/** 只替换角色命中配置，保留正式技能与怪物数据，避免通过修改共享定义准备场景。 */
function createWorld(hitRate: number, catalog: readonly CharacterSkillDefinition[] = createLocalWorld().character.skillCatalog, learnedSkillIds: readonly string[] = ['heavy-strike']) {
  const world = createLocalWorld()
  world.character = new Character({
    id: world.character.id, name: world.character.name, characterClass: 'warrior', level: 1,
    stats: { ...world.character.levelStats, hitRate }, growth: world.character.growth,
    skills: catalog, learnedSkillIds,
  })
  return world
}

/** 有限随机序列用尽即失败，检测命中、冷却失败与确定概率的实际抽取次数。 */
function sequence(values: readonly number[]) {
  let calls = 0
  return {
    random: () => {
      assert.ok(calls < values.length, '出现非预期的随机抽取')
      return values[calls++]
    },
    count: () => calls,
  }
}

test('命中概率按攻击方配置与左闭右开边界判定，确定结果不抽随机数', () => {
  const stats = createWorld(0.4).character.stats
  assert.equal(calculateHitChance(stats), 0.4)
  const source = sequence([0, 0.399999, 0.4, 0.999999])
  assert.deepEqual(Array.from({ length: 4 }, () => rollHit(stats, source.random)), [true, true, false, false])
  assert.equal(source.count(), 4)
  const certain = sequence([])
  assert.equal(rollHit({ ...stats, hitRate: 1 }, certain.random), true)
  assert.equal(rollHit({ ...stats, hitRate: 0 }, certain.random), false)
  assert.equal(calculateHitChance({ ...stats, hitRate: 1.2 }), 1)
  assert.equal(calculateHitChance({ ...stats, hitRate: -0.1 }), 0)
  assert.equal(certain.count(), 0)
})

test('普攻未命中不扣血也不耗魔，后续命中仍走原物理伤害公式', () => {
  const { character, monster } = createWorld(0.5)
  const source = sequence([0.5, 0.499999])
  const battle = new Battle(source.random)
  const missed = battle.attack(character, monster)
  assert.equal(missed.success, true)
  if (missed.success) {
    assert.equal(missed.hit, false)
    assert.equal(missed.damage, 0)
    assert.equal(missed.targetDead, false)
  }
  assert.equal(monster.health, 80)
  assert.equal(character.mana, 30)
  const hit = battle.attack(character, monster)
  assert.equal(hit.success, true)
  if (hit.success) {
    assert.equal(hit.hit, true)
    assert.equal(hit.damage, 12)
  }
  assert.equal(monster.health, 68)
  assert.equal(source.count(), 2)
})

test('命中但攻击不破防仍记录 hit=true，不能误标成未命中', () => {
  const { character, monster } = createWorld(1)
  const battle = new Battle(sequence([]).random)
  const result = battle.attack(monster, character)
  assert.equal(result.success, true)
  if (result.success) assert.equal(result.hit, true)
  const armor = new Item('blocking-armor', { id: 'blocking-armor', name: '厚甲', type: 'equipment', quality: 'normal', equipment: { slot: 'armor', stats: { defense: 100 }, requirements: { level: 1, classes: [] } } })
  character.receiveItem(armor)
  character.equip(armor.id)
  const blocked = battle.attack(monster, character)
  assert.equal(blocked.success, true)
  if (blocked.success) {
    assert.equal(blocked.hit, true)
    assert.equal(blocked.damage, 0)
  }
})

test('物理技能未命中照常耗蓝和进入冷却，冷却失败不再抽取命中', () => {
  const { character, monster } = createWorld(0.5)
  const source = sequence([0.8, 0.2])
  const battle = new Battle(source.random)
  const skill = character.skills[0]
  const missed = battle.castSkill(character, monster, skill, 1000)
  assert.equal(missed.success, true)
  if (missed.success) assert.deepEqual(missed.effects, [{ type: 'physicalDamage', targetId: monster.id, amount: 0, hit: false }])
  assert.equal(character.mana, 25)
  assert.equal(monster.health, 80)
  assert.equal(battle.getRemainingCooldown(character, skill, 1000), 1000)
  assert.deepEqual(battle.castSkill(character, monster, skill, 1500), { success: false, reason: 'cooldown' })
  assert.equal(source.count(), 1)
  const hit = battle.castSkill(character, monster, skill, 2000)
  assert.equal(hit.success, true)
  if (hit.success) assert.deepEqual(hit.effects, [{ type: 'physicalDamage', targetId: monster.id, amount: 18, hit: true }])
  assert.equal(character.mana, 20)
  assert.equal(monster.health, 62)
  assert.equal(source.count(), 2)
})

test('固定伤害、治疗和回蓝不判命中，不消耗命中随机数', () => {
  const catalog: readonly CharacterSkillDefinition[] = [{
    requiredLevel: 1, characterClass: 'warrior',
    skill: { id: 'fixed-effects', name: '固定效果', type: 'active', manaCost: 5, cooldownMs: 1000, effects: [
      { type: 'damage', target: 'target', amount: 12 },
      { type: 'heal', target: 'self', amount: 20 },
      { type: 'restoreMana', target: 'self', amount: 10 },
    ] },
  }]
  const { character, monster } = createWorld(0, catalog, ['fixed-effects'])
  character.takeDamage(10)
  character.consumeMana(10)
  const source = sequence([])
  const cast = new Battle(source.random).castSkill(character, monster, character.skills[0], 1000)
  assert.equal(cast.success, true)
  if (cast.success) assert.deepEqual(cast.effects, [
    { type: 'damage', targetId: monster.id, amount: 12 },
    { type: 'heal', targetId: character.id, amount: 10 },
    { type: 'restoreMana', targetId: character.id, amount: 10 },
  ])
  assert.equal(monster.health, 68)
  assert.equal(character.health, 120)
  assert.equal(character.mana, 25)
  assert.equal(source.count(), 0)
})

test('同一次物理技能只判定一次命中，未命中不取消同技能的恢复效果', () => {
  const catalog: readonly CharacterSkillDefinition[] = [{
    requiredLevel: 1, characterClass: 'warrior',
    skill: { id: 'physical-pair', name: '双段物理', type: 'active', manaCost: 5, cooldownMs: 1000, effects: [
      { type: 'physicalDamage', target: 'target', attackBonus: 6 },
      { type: 'physicalDamage', target: 'target', attackBonus: 10 },
      { type: 'heal', target: 'self', amount: 5 },
    ] },
  }]
  for (const [roll, expectedHealth] of [[0.2, 40], [0.8, 80]]) {
    const { character, monster } = createWorld(0.5, catalog, ['physical-pair'])
    character.takeDamage(10)
    const source = sequence([roll])
    const result = new Battle(source.random).castSkill(character, monster, character.skills[0], 1000)
    assert.equal(result.success, true)
    assert.equal(monster.health, expectedHealth)
    assert.equal(character.health, 115)
    assert.equal(source.count(), 1)
  }
})

test('魔法不足的技能不会抽取命中随机数或启动冷却', () => {
  const { character, monster } = createWorld(0.5)
  character.consumeMana(30)
  const source = sequence([])
  const battle = new Battle(source.random)
  assert.deepEqual(battle.castSkill(character, monster, character.skills[0], 1000), { success: false, reason: 'insufficientMana' })
  assert.equal(battle.getRemainingCooldown(character, character.skills[0], 1000), 0)
  assert.equal(source.count(), 0)
})

test('未命中技能占用本次行动，不额外普攻，页面显示未命中而不是零伤害', () => {
  const world = createWorld(0.5)
  const source = sequence([0.8, 0.2])
  const game = createGameStore(world, () => 0, source.random)
  game.store.getState().startBattle()
  game.store.getState().stopBattle()
  game.advanceTo(1000)
  const state = game.store.getState()
  assert.equal(state.battle.lastAction!.hit, false)
  assert.equal(state.battle.lastAction!.damage, 0)
  assert.equal(state.battle.logs.length, 2)
  assert.match(state.battle.logs[1].text, /重击，未命中野狼/)
  assert.equal(state.monster.health, 80)
  assert.equal(state.character.health, 114)
  assert.equal(state.character.mana, 25)
  assert.equal(state.character.hitChance, 0.5)
  assert.ok(state.character.fields.some((field) => field.label === '命中率' && field.value === '50%'))
  game.advanceTo(2000)
  assert.equal(game.store.getState().battle.lastAction!.hit, true)
  assert.equal(world.monster.health, 62)
  assert.equal(source.count(), 2)
})

test('有随机命中时长短时间推进仍得到相同战斗、掉落与随机调用次数', () => {
  /** 使用循环序列覆盖命中、未命中与后续掉落，记录真实随机消费顺序。 */
  function play(shortSteps: boolean) {
    const world = createWorld(0.5)
    let calls = 0
    const random = () => [0.75, 0.25][calls++ % 2]
    const session = new CombatSession(world.character, world.monster, random)
    session.start()
    if (shortSteps) {
      for (let time = 100; time <= 60000; time += 100) session.advanceTo(time)
    } else session.advanceTo(60000)
    assert.equal(session.status, 'victory')
    const count = calls
    session.advanceTo(120000)
    assert.equal(calls, count)
    assert.equal(world.character.experience, 20)
    return { records: session.records, stats: world.character.stats, health: world.character.health, calls }
  }
  assert.deepEqual(play(true), play(false))
})

test('命中装备加成影响后续攻击，穿脱与页面百分比保持一致', () => {
  const { character, monster } = createWorld(0.5)
  const necklace = new Item('hit-necklace', { id: 'hit-necklace', name: '命中项链', type: 'equipment', quality: 'normal', equipment: { slot: 'necklace', stats: { hitRate: 0.25 }, requirements: { level: 1, classes: [] } } })
  character.receiveItem(necklace)
  const battle = new Battle(() => 0.6)
  const before = battle.attack(character, monster)
  if (before.success) assert.equal(before.hit, false)
  assert.deepEqual(readInventory(character).items.find((item) => item.id === necklace.id)!.bonuses, ['命中率 +25%'])
  character.equip(necklace.id)
  assert.equal(readCharacterInfo(character).hitChance, 0.75)
  const after = battle.attack(character, monster)
  if (after.success) assert.equal(after.hit, true)
  character.unequip('necklace')
  assert.equal(character.stats.hitRate, 0.5)
  const unequipped = battle.attack(character, monster)
  if (unequipped.success) assert.equal(unequipped.hit, false)
})
