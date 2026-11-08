import assert from 'node:assert/strict'
import { test } from 'node:test'
import { Character, IdleCombatSession, Item, Monster } from '../src/core'
import type { DamageRecord, MonsterDefinition, RandomSource } from '../src/core'
import { createLocalWorld } from '../src/game/data/localWorld'
import { localSkills } from '../src/game/data/localSkills'
import { createGameStore } from '../src/stores/gameStore'

/** 直接使用本地角色和刷新工厂，测试不依赖浏览器、真实时钟或定时器。 */
function createLoop(random: RandomSource = () => 0.99) {
  const world = createLocalWorld()
  const loop = new IdleCombatSession(world.character, world.monster, world.createMonster, random)
  return { world, loop }
}

/** 短战怪物用于验证每场冷却重置，零经验避免升级回满掩盖战后资源规则。 */
function shortWorld(health = 30) {
  const world = createLocalWorld()
  world.character = new Character({
    id: 'cooldown-character', name: '冷却验证角色', characterClass: 'warrior', level: 1,
    stats: world.character.stats, growth: world.character.growth,
    skills: [{ skill: { ...localSkills.heavyStrike, cooldownMs: 10000 }, requiredLevel: 1, characterClass: 'warrior' }],
    learnedSkillIds: [localSkills.heavyStrike.id],
  })
  const definition: MonsterDefinition = {
    id: 'short-wolf', name: '短战野狼', level: 1, rank: 'normal', skills: [localSkills.wolfBite],
    stats: { ...world.monster.stats, maxHealth: health }, rewards: { experience: 0, drops: world.monster.rewards.drops },
  }
  world.createMonster = (number) => new Monster(`short-wolf-${number}`, definition)
  world.monster = world.createMonster(1)
  return world
}

test('胜利等待完整两秒才创建全新怪物，刷新不共享资源且跨场奖励只结算一次', () => {
  const { world, loop } = createLoop(() => 0)
  const first = loop.monster
  assert.equal(loop.start(), true)
  loop.advanceTo(5000)
  assert.equal(loop.phase, 'waiting')
  assert.equal(loop.kills, 1)
  assert.equal(world.character.experience, 20)
  assert.strictEqual(loop.monster, first)
  assert.equal(first.health, 0)
  loop.advanceTo(6999)
  assert.strictEqual(loop.monster, first)
  loop.advanceTo(7000)
  assert.equal(loop.phase, 'fighting')
  assert.notStrictEqual(loop.monster, first)
  assert.notEqual(loop.monster.id, first.id)
  assert.equal(loop.monster.health, loop.monster.stats.maxHealth)
  assert.equal(loop.monster.mana, loop.monster.stats.maxMana)
  assert.equal(first.health, 0)
  loop.advanceTo(12000)
  assert.equal(loop.kills, 2)
  assert.equal(world.character.experience, 40)
  const ends = loop.records.filter((entry) => entry.type === 'end')
  assert.equal(ends.length, 2)
  const dropIds = ends.flatMap((entry) => entry.items.map((item) => item.id))
  assert.equal(new Set(dropIds).size, 6)
  assert.equal(new Set(loop.records.map((entry) => entry.id)).size, loop.records.length)
  assert.ok(loop.records.every((entry, index, records) => index === 0 || entry.timeMs >= records[index - 1].timeMs))
  loop.stop()
  loop.advanceTo(60000)
  assert.equal(world.character.experience, 40)
})

test('持续多场长短推进与共享随机源的消耗顺序、成长、背包和日志完全一致', () => {
  /** 固定循环输入同时覆盖未命中、装备掉落、品质和极品生成。 */
  function play(frequent: boolean) {
    const values = [0.1, 0.9, 0.4, 0.05, 0.99, 0.2, 0.7, 0.01, 0.8]
    let calls = 0
    const world = createLocalWorld()
    const accuracy = new Item('accuracy', { id: 'accuracy', name: '命中验证武器', quality: 'normal', type: 'equipment', equipment: { slot: 'weapon', stats: { hitRate: -0.3 }, requirements: { level: 1, classes: [] } } })
    world.character.receiveItem(accuracy)
    world.character.equip(accuracy.id)
    const loop = new IdleCombatSession(world.character, world.monster, world.createMonster, () => values[calls++ % values.length])
    loop.start()
    if (frequent) for (let time = 100; time <= 120000; time += 100) loop.advanceTo(time)
    else loop.advanceTo(120000)
    assert.ok(loop.kills > 2)
    assert.ok(loop.records.some((entry) => entry.type === 'damage' && !entry.hit))
    return { calls, records: loop.records, phase: loop.phase, time: loop.elapsedMs, battle: loop.battleNumber, health: world.character.health, mana: world.character.mana, experience: world.character.experience, items: world.character.items, pending: world.character.pendingItems }
  }
  assert.deepEqual(play(false), play(true))
})

test('战中停止打完本场一次，长推进停在结算点且再次开始保留两秒等待', () => {
  const { world, loop } = createLoop()
  loop.start()
  loop.advanceTo(2000)
  loop.stop()
  loop.stop()
  assert.equal(loop.phase, 'fighting')
  assert.equal(loop.stopRequested, true)
  assert.equal(loop.start(), false)
  loop.advanceTo(60000)
  assert.equal(loop.phase, 'stopped')
  assert.equal(loop.elapsedMs, 5000)
  assert.equal(loop.waitRemainingMs, 2000)
  assert.equal(loop.kills, 1)
  assert.equal(world.character.experience, 20)
  loop.advanceTo(120000)
  assert.equal(loop.elapsedMs, 5000)
  assert.equal(loop.start(), true)
  assert.equal(loop.start(), false)
  loop.advanceTo(6999)
  assert.equal(loop.phase, 'waiting')
  assert.equal(loop.battleNumber, 1)
  loop.advanceTo(7000)
  assert.equal(loop.battleNumber, 2)
  assert.equal(world.character.experience, 20)
})

test('等待中立即停止，停止期间不消耗倒计时，重复启停不能跳过等待或重领奖励', () => {
  const { world, loop } = createLoop()
  loop.stop()
  assert.equal(loop.phase, 'idle')
  loop.start()
  loop.advanceTo(5500)
  assert.equal(loop.waitRemainingMs, 1500)
  loop.stop()
  assert.equal(loop.phase, 'stopped')
  loop.advanceTo(60000)
  loop.start()
  loop.stop()
  loop.start()
  assert.equal(loop.waitRemainingMs, 1500)
  loop.advanceTo(6999)
  assert.equal(loop.battleNumber, 1)
  assert.equal(world.character.experience, 20)
  loop.advanceTo(7000)
  assert.equal(loop.phase, 'fighting')
  assert.equal(loop.battleNumber, 2)
})

test('每场冷却重置，战后和刷新均不额外恢复生命魔法', () => {
  const world = shortWorld()
  const loop = new IdleCombatSession(world.character, world.monster, world.createMonster, () => 0.99)
  loop.start()
  loop.advanceTo(2000)
  assert.equal(loop.phase, 'waiting')
  assert.equal(world.character.health, 114)
  assert.equal(world.character.mana, 25)
  loop.advanceTo(4000)
  assert.equal(world.character.health, 114)
  assert.equal(world.character.mana, 25)
  loop.advanceTo(6000)
  assert.equal(world.character.health, 108)
  assert.equal(world.character.mana, 20)
  const firstActions = loop.records.filter((entry): entry is DamageRecord => entry.type === 'damage' && [1000, 5000].includes(entry.timeMs))
  assert.deepEqual(firstActions.map((entry) => entry.actionName), ['重击', '撕咬', '重击', '撕咬'])
})

test('死亡立即停止且无额外惩罚，复活满资源但必须手动开始新场', () => {
  const { world, loop } = createLoop()
  world.character.gainExperience(5)
  world.character.takeDamage(119)
  world.character.consumeMana(25)
  const items = world.character.items
  assert.equal(loop.revive(), false)
  loop.start()
  loop.advanceTo(60000)
  assert.equal(loop.phase, 'dead')
  assert.equal(loop.elapsedMs, 1000)
  assert.equal(loop.kills, 0)
  assert.equal(world.character.experience, 5)
  assert.deepEqual(world.character.items, items)
  assert.equal(world.character.isInCombat, false)
  assert.equal(loop.start(), false)
  const previous = loop.monster
  assert.equal(loop.revive(), true)
  assert.equal(loop.revive(), false)
  assert.equal(loop.phase, 'stopped')
  assert.equal(world.character.health, world.character.stats.maxHealth)
  assert.equal(world.character.mana, world.character.stats.maxMana)
  loop.advanceTo(120000)
  assert.equal(loop.elapsedMs, 1000)
  assert.strictEqual(loop.monster, previous)
  assert.equal(loop.start(), true)
  assert.equal(loop.battleNumber, 2)
  assert.notStrictEqual(loop.monster, previous)
  assert.equal(loop.monster.health, 80)
  loop.advanceTo(1999)
  assert.equal(loop.records.length, 3)
  loop.advanceTo(2000)
  assert.equal(loop.records.length, 5)
})

test('仓库等待倒计时、怪物、最近奖励及跨场日志与背包累计同步', () => {
  const world = createLocalWorld()
  const game = createGameStore(world, () => 0, () => 0.99)
  game.store.getState().startBattle()
  game.advanceTo(5500)
  assert.equal(game.store.getState().battle.phase, 'waiting')
  assert.equal(game.store.getState().battle.waitRemainingSeconds, '1.5')
  assert.equal(game.store.getState().battle.canStop, true)
  game.advanceTo(12000)
  const state = game.store.getState()
  assert.equal(state.battle.kills, 2)
  assert.equal(state.monster.id, 'local-monster-2')
  assert.equal(state.obtainedItems, '狼牙 × 1')
  assert.equal(world.character.items.find((item) => item.definitionId === 'wolf-fang')!.quantity, 2)
  assert.equal(new Set(state.battle.logs.map((entry) => entry.id)).size, state.battle.logs.length)
  assert.ok(state.battle.logs.some((entry) => entry.timeSeconds > 8))
  game.advanceTo(13000)
  assert.equal(game.store.getState().monster.id, 'local-monster-3')
  assert.equal(game.store.getState().battle.monsterHit, undefined)
  assert.equal(game.store.getState().battle.characterHit, undefined)
  assert.equal(game.store.getState().battle.lastAction, undefined)
  assert.equal(game.store.getState().battle.logs.length, state.battle.logs.length, '刷新清空当前提示，但不清除跨场日志')
  game.advanceTo(14000)
  assert.equal(game.store.getState().battle.characterHit!.attackerId, 'local-monster-3')
  assert.equal(game.store.getState().battle.lastAction!.targetId, 'local-monster-3')
})

test('宿主停止后再次开始从实际结算点计时，不追赶停止期间墙钟', () => {
  const world = createLocalWorld()
  let time = 10000
  const game = createGameStore(world, () => time, () => 0.99)
  game.store.getState().startBattle()
  time = 12000
  game.store.getState().stopBattle()
  time = 70000
  game.synchronizeTime()
  assert.equal(game.store.getState().battle.phase, 'stopped')
  assert.equal(game.store.getState().battle.waitRemainingSeconds, '2.0')
  time = 100000
  game.synchronizeTime()
  game.store.getState().startBattle()
  time = 101999
  game.synchronizeTime()
  assert.equal(game.store.getState().battle.phase, 'waiting')
  assert.equal(world.character.experience, 20)
  time = 102000
  game.synchronizeTime()
  assert.equal(world.monster.id, 'local-monster-2')
  assert.equal(world.monster.health, 80)
  time = 103000
  game.synchronizeTime()
  assert.equal(world.monster.health, 60)
})

test('宿主等待停止保留剩余毫秒，恢复不会计入停机墙钟', () => {
  const world = createLocalWorld()
  let time = 0
  const game = createGameStore(world, () => time, () => 0.99)
  game.store.getState().startBattle()
  time = 5500
  game.store.getState().stopBattle()
  assert.equal(game.store.getState().battle.phase, 'stopped')
  assert.equal(game.store.getState().battle.waitRemainingSeconds, '1.5')
  time = 60000
  game.store.getState().startBattle()
  time = 61499
  game.synchronizeTime()
  assert.equal(world.monster.id, 'local-monster-1')
  time = 61500
  game.synchronizeTime()
  assert.equal(world.monster.id, 'local-monster-2')
})

test('仓库战斗中禁止学习，停止请求不解锁，等待中学习且不恢复资源', () => {
  const world = createLocalWorld()
  let time = 0
  const game = createGameStore(world, () => time, () => 0.99)
  const passive = localSkills.strongBody.id
  game.store.getState().startBattle()
  game.store.getState().stopBattle()
  game.store.getState().learnSkill(passive)
  assert.equal(world.character.learnedSkillIds.includes(passive), false)
  time = 6000
  // 宿主同步结束当前战斗，再显式继续等待。
  game.synchronizeTime()
  game.store.getState().startBattle()
  assert.equal(game.store.getState().battle.phase, 'waiting')
  game.store.getState().learnSkill(passive)
  assert.equal(world.character.learnedSkillIds.includes(passive), true)
  assert.equal(world.character.health, 132)
  assert.equal(world.character.stats.maxHealth, 152)
  time = 8000
  game.synchronizeTime()
  assert.equal(world.character.isInCombat, true)
})

test('仓库死亡复活按钮状态与资源同步，复活不自动续战也不重领旧场奖励', () => {
  const world = createLocalWorld()
  world.character.takeDamage(119)
  let time = 0
  const game = createGameStore(world, () => time, () => 0.99)
  game.store.getState().startBattle()
  time = 60000
  game.synchronizeTime()
  assert.equal(game.store.getState().battle.canRevive, true)
  assert.equal(game.store.getState().battle.canStart, false)
  assert.equal(game.store.getState().battle.isActive, false)
  game.store.getState().revive()
  assert.equal(game.store.getState().character.health, 120)
  assert.equal(game.store.getState().character.mana, 30)
  assert.equal(game.store.getState().battle.canStart, true)
  assert.equal(game.store.getState().battle.canRevive, false)
  time = 120000
  game.synchronizeTime()
  assert.equal(game.store.getState().battle.battleNumber, 1)
  game.store.getState().startBattle()
  time = 120999
  game.synchronizeTime()
  assert.equal(world.monster.health, 80)
  time = 121000
  game.synchronizeTime()
  assert.equal(world.monster.health, 62)
  assert.equal(world.character.experience, 0)
})

test('连续挂机中延迟换装和用药遵循先结算操作时刻行动，长短采样一致', () => {
  /** 操作跨越胜利、等待和下一场，验证新装备或药水不会追溯改变历史行动。 */
  function play(frequent: boolean) {
    const world = createLocalWorld()
    let time = 0
    const game = createGameStore(world, () => time, () => 0.99)
    const wood = world.character.items.find((item) => item.definitionId === 'wood-sword')!
    const potion = world.character.items.find((item) => item.type === 'consumable')!
    game.store.getState().startBattle()
    let previous = 0
    for (const next of [2500, 6500, 9000, 10000, 16000, 20000]) {
      if (frequent) for (let tick = previous + 100; tick < next; tick += 100) {
        time = tick
        game.synchronizeTime()
      }
      time = next
      if (next === 2500) game.store.getState().equipItem(wood.id)
      else if (next === 6500) game.store.getState().unequipItem('weapon')
      else if (next === 9000) game.store.getState().useItem(potion.id)
      else if (next === 10000) game.store.getState().equipItem(wood.id)
      else if (next === 16000) game.store.getState().stopBattle()
      else game.synchronizeTime()
      previous = next
    }
    assert.ok(game.store.getState().battle.kills >= 2)
    return game.store.getState()
  }
  const one = play(false)
  const two = play(true)
  assert.deepEqual(one.battle, two.battle)
  assert.deepEqual(one.inventory, two.inventory)
  assert.deepEqual(one.character, two.character)
  assert.deepEqual(one.monster, two.monster)
})
