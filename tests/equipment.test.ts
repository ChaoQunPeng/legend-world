import assert from 'node:assert/strict'
import { test } from 'node:test'
import { Item, Monster } from '../src/core'
import { createLocalWorld } from '../src/game/data/localWorld'
import { readInventory } from '../src/game/panels/inventory'
import { createGameStore } from '../src/stores/gameStore'

/** 延长对战以覆盖多次换装；时间通过宿主注入，不依赖真实定时器。 */
function createTimedGame() {
  const world = createLocalWorld()
  world.monster = new Monster('timing-wolf', {
    id: 'timing-wolf', name: '时序验证野狼', level: 1, rank: 'normal', skills: [],
    stats: { maxHealth: 1000, maxMana: 0, attack: 12, defense: 6, magicAttack: 0, magicDefense: 2, hitRate: 1 },
    rewards: { experience: 20, drops: [] },
  })
  let elapsed = 0
  const game = createGameStore(world, () => 5000 + elapsed, () => 0.99)
  const weapon = world.character.items.find((item) => item.definitionId === 'wood-sword')!
  game.store.getState().startBattle()
  game.store.getState().stopBattle()
  return { world, game, weapon, setTime: (value: number) => { elapsed = value } }
}

test('等级不足与职业不符不改变装备归属，升级后条件实时更新', () => {
  const { character } = createLocalWorld()
  const wood = character.items.find((item) => item.definitionId === 'wood-sword')!
  const iron = character.items.find((item) => item.definitionId === 'iron-sword')!
  character.equip(wood.id)
  assert.deepEqual(character.equip(iron.id), { canEquip: false, reason: 'level' })
  assert.strictEqual(character.equipment.get('weapon'), wood)
  assert.strictEqual(character.items.find((item) => item.id === iron.id), iron)
  const lockedView = readInventory(character).items.find((item) => item.id === iron.id)!
  assert.equal(lockedView.canEquip, false)
  assert.equal(lockedView.equipFailure, '等级不足')
  assert.equal(lockedView.requirementsLabel, '需要 Lv.2 · 不限职业')
  const staff = new Item('mage-staff', { id: 'mage-staff', name: '法师法杖', quality: 'normal', type: 'equipment', equipment: { slot: 'weapon', stats: { magicAttack: 8 }, requirements: { level: 1, classes: ['mage'] } } })
  character.receiveItem(staff)
  assert.deepEqual(character.equip(staff.id), { canEquip: false, reason: 'class' })
  assert.strictEqual(character.equipment.get('weapon'), wood)
  character.gainExperience(20)
  assert.equal(readInventory(character).items.find((item) => item.id === iron.id)!.canEquip, true)
  assert.equal(character.equip(iron.id).canEquip, true)
  assert.strictEqual(character.equipment.get('weapon'), iron)
  assert.strictEqual(character.items.find((item) => item.id === wood.id), wood)
  assert.equal(character.stats.attack, 27)
})

test('延迟到 2.5 秒换装，前两次攻击保留旧伤害，第三次使用新属性', () => {
  const { world, game, weapon, setTime } = createTimedGame()
  setTime(2500)
  game.store.getState().equipItem(weapon.id)
  assert.equal(world.monster.health, 964)
  assert.equal(world.character.health, 116)
  assert.equal(game.store.getState().battle.lastAction?.damage, 18)
  setTime(3000)
  game.synchronizeTime()
  assert.equal(game.store.getState().battle.lastAction?.damage, 21)
  assert.equal(world.monster.health, 943)
})

test('攻击与换装同在第 1 秒时先行动，卸下也遵循相同顺序', () => {
  const { game, weapon, setTime } = createTimedGame()
  setTime(1000)
  game.store.getState().equipItem(weapon.id)
  assert.equal(game.store.getState().battle.lastAction?.damage, 18)
  setTime(2000)
  game.store.getState().unequipItem('weapon')
  assert.equal(game.store.getState().battle.lastAction?.damage, 21)
  setTime(3000)
  game.synchronizeTime()
  assert.equal(game.store.getState().battle.lastAction?.damage, 18)
})

test('同一时刻连续穿脱不重复行动或叠加属性', () => {
  const { world, game, weapon, setTime } = createTimedGame()
  setTime(2500)
  game.store.getState().equipItem(weapon.id)
  const count = game.store.getState().battle.logs.length
  game.store.getState().unequipItem('weapon')
  game.store.getState().equipItem(weapon.id)
  assert.equal(game.store.getState().battle.logs.length, count)
  assert.equal(world.character.stats.attack, 21)
  assert.equal(world.character.items.filter((item) => item.id === weapon.id).length, 0)
  setTime(3000)
  game.synchronizeTime()
  assert.equal(game.store.getState().battle.lastAction?.damage, 21)
})

/** 相同操作时间线分别使用密集与延迟采样，比对完整日志、生命和最终属性。 */
test('相同换装时间线不受浏览器采样频率影响', () => {
  function play(frequent: boolean) {
    const { world, game, weapon, setTime } = createTimedGame()
    const armor = world.character.items.find((item) => item.definitionId === 'cloth-armor')!
    let previous = 0
    for (const time of [2500, 3200, 4000, 6000]) {
      if (frequent) {
        for (let tick = previous + 100; tick < time; tick += 100) {
          setTime(tick)
          game.synchronizeTime()
        }
      }
      setTime(time)
      if (time === 2500) game.store.getState().equipItem(weapon.id)
      if (time === 3200) game.store.getState().equipItem(armor.id)
      if (time === 4000) game.store.getState().unequipItem('weapon')
      if (time === 6000) game.synchronizeTime()
      previous = time
    }
    return { logs: game.store.getState().battle.logs, health: world.character.health, mana: world.character.mana, stats: world.character.stats, monsterHealth: world.monster.health }
  }
  assert.deepEqual(play(false), play(true))
})

test('换装前发生击杀时先升级再检查穿戴，不把新武器应用到历史伤害', () => {
  const world = createLocalWorld()
  let time = 0
  const game = createGameStore(world, () => time, () => 0.99)
  game.store.getState().startBattle()
  game.store.getState().stopBattle()
  time = 6000
  const iron = world.character.items.find((item) => item.definitionId === 'iron-sword')!
  game.store.getState().equipItem(iron.id)
  assert.equal(game.store.getState().battle.status, 'victory')
  assert.equal(world.character.level, 2)
  assert.strictEqual(world.character.equipment.get('weapon'), iron)
  assert.equal(game.store.getState().battle.lastAction?.damage, 8)
  assert.equal(world.character.experience, 20)
  game.synchronizeTime()
  assert.equal(world.character.experience, 20)
})

test('延迟期间角色已死亡时用药不能抢在过去的攻击之前复活', () => {
  const { world, game, setTime } = createTimedGame()
  world.character.takeDamage(119)
  const potion = world.character.items.find((item) => item.type === 'consumable')!
  setTime(2500)
  game.store.getState().useItem(potion.id)
  assert.equal(game.store.getState().battle.status, 'defeat')
  assert.equal(world.character.health, 0)
  assert.equal(world.character.items.find((item) => item.id === potion.id)!.quantity, 5)
  assert.equal(world.monster.health, 982)
})
