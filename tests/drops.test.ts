import assert from 'node:assert/strict'
import { test } from 'node:test'
import { CombatSession, Item, generateEquipmentQuality, generateExceptionalStats, rollDrops } from '../src/core'
import { createLocalWorld } from '../src/game/data/localWorld'
import { readInventory } from '../src/game/panels/inventory'
import { readMonsterInfo } from '../src/game/panels/unitInfo'
import { createGameStore } from '../src/stores/gameStore'

/** 有限序列用尽即失败，确保查询、穿脱和重复结算不暗中消耗随机数。 */
function sequence(values: readonly number[]) {
  let calls = 0
  return {
    random: () => {
      assert.ok(calls < values.length, '随机调用次数超过指定序列')
      return values[calls++]
    },
    count: () => calls,
  }
}

/** 直接复用怪物真实掉落表和装备定义，保持测试与业务契约一致。 */
function definitions() {
  return createLocalWorld().monster.rewards.drops
}

test('掉落概率使用左闭右开边界，100% 材料必掉且装备可全部落空', () => {
  const source = sequence([0.999, 0.3, 0.1])
  assert.deepEqual(rollDrops(definitions(), 'boundary', source.random).map((item) => item.name), ['狼牙'])
  assert.equal(source.count(), 3)
  const hits = sequence([0, 0.299999, 0.99, 0.2, 0.099999, 0.99, 0.2])
  assert.deepEqual(rollDrops(definitions(), 'hits', hits.random).map((item) => item.name), ['狼牙', '木剑', '精铁剑'])
  assert.equal(hits.count(), 7)
})

test('每条掉落独立判定，木剑落空后精铁剑仍可命中', () => {
  const source = sequence([0.9, 0.3, 0, 0.8, 0.9])
  const items = rollDrops(definitions(), 'independent', source.random)
  assert.deepEqual(items.map((item) => item.name), ['狼牙', '精铁剑'])
  assert.equal(items[1].quality, 'uncommon')
  assert.deepEqual(items[1].additionalStats, {})
})

test('品质四个区间边界准确，单次生成只消耗一次随机输入', () => {
  const inputs = [0, 0.699999, 0.7, 0.899999, 0.9, 0.979999, 0.98, 0.999999]
  const source = sequence(inputs)
  assert.deepEqual(inputs.map(() => generateEquipmentQuality(source.random)), ['normal', 'normal', 'uncommon', 'uncommon', 'rare', 'rare', 'epic', 'epic'])
  assert.equal(source.count(), inputs.length)
})

test('极品 20% 边界、两种属性及均匀 +1～3 区间准确', () => {
  assert.deepEqual(generateExceptionalStats(sequence([0.2]).random), {})
  for (const [roll, amount] of [[0, 1], [1 / 3, 2], [2 / 3, 3], [0.999999, 3]]) {
    assert.deepEqual(generateExceptionalStats(sequence([0.199999, 0.499999, roll]).random), { attack: amount })
    assert.deepEqual(generateExceptionalStats(sequence([0, 0.5, roll]).random), { defense: amount })
  }
})

test('品质与极品独立，同种装备能获得不同结果且品质不改变基础属性', () => {
  const entry = [definitions()[1]]
  const ordinary = rollDrops(entry, 'ordinary', sequence([0, 0, 0, 0, 0.999]).random)[0]
  const epic = rollDrops(entry, 'epic', sequence([0, 0.99, 0.2]).random)[0]
  assert.equal(ordinary.quality, 'normal')
  assert.deepEqual(ordinary.additionalStats, { attack: 3 })
  assert.equal(epic.quality, 'epic')
  assert.deepEqual(epic.additionalStats, {})
  assert.deepEqual(ordinary.equipment, epic.equipment)
  const { character } = createLocalWorld()
  character.receiveItem(epic)
  character.equip(epic.id)
  assert.equal(character.stats.attack, 21)
  character.receiveItem(ordinary)
  character.equip(ordinary.id)
  assert.equal(character.stats.attack, 24)
})

test('掉落实例穿脱与重复查询不重抽，基础和极品独立展示并汇总', () => {
  const { character } = createLocalWorld()
  const source = sequence([0, 0.9, 0, 0.5, 0.4])
  const item = rollDrops([definitions()[1]], 'fixed', source.random)[0]
  character.receiveItem(item)
  const view = readInventory(character).items.find((entry) => entry.id === item.id)!
  assert.equal(view.qualityLabel, '稀有')
  assert.deepEqual(view.bonuses, ['物理攻击 +3'])
  assert.deepEqual(view.additionalBonuses, ['物理防御 +2'])
  for (let index = 0; index < 3; index += 1) {
    character.equip(item.id)
    assert.strictEqual(character.equipment.get('weapon'), item)
    assert.equal(character.stats.attack, 21)
    assert.equal(character.stats.defense, 12)
    readInventory(character)
    character.unequip('weapon')
    assert.equal(character.stats.attack, 18)
    assert.equal(character.stats.defense, 10)
    assert.strictEqual(character.items.find((entry) => entry.id === item.id), item)
  }
  assert.equal(source.count(), 5)
})

test('满包战斗掉落保留原随机实例，领取失败及成功均不重抽或重复发奖', () => {
  const world = createLocalWorld()
  const definition = definitions()[1].item
  for (let index = world.character.items.length; index < 30; index += 1) {
    world.character.receiveItem(new Item(`fill-${index}`, definition))
  }
  const source = sequence([0.5, 0, 0.99, 0, 0, 0.999, 0.1])
  const session = new CombatSession(world.character, world.monster, source.random)
  session.start()
  session.advanceTo(60000)
  const end = session.records.at(-1)!
  assert.equal(end.type, 'end')
  if (end.type !== 'end') return
  assert.equal(end.pendingItemCount, 2)
  const item = end.items[1]
  assert.strictEqual(world.character.pendingItems[1], item)
  assert.equal(item.quality, 'epic')
  assert.deepEqual(item.additionalStats, { attack: 3 })
  assert.deepEqual(world.character.claimItem(item.id), { received: 0, pending: 1 })
  world.character.discardItem(world.character.items[0].id, 1)
  assert.deepEqual(world.character.claimItem(item.id), { received: 1, pending: 0 })
  assert.strictEqual(world.character.items.find((entry) => entry.id === item.id), item)
  world.character.claimItem(item.id)
  session.advanceTo(120000)
  assert.equal(session.start(), false)
  assert.equal(world.character.experience, 20)
  assert.equal(world.character.items.filter((entry) => entry.id === item.id).length, 1)
  assert.equal(source.count(), 7)
})

test('随机奖励在长短时间推进下完全一致，页面同步实际品质与额外属性', () => {
  /** 两种推进方式使用相同有限随机序列，比较完整记录和页面快照。 */
  function play(shortSteps: boolean) {
    const world = createLocalWorld()
    const source = sequence([0, 0, 0.75, 0, 0.5, 0, 0, 0.99, 0.2])
    const game = createGameStore(world, () => 0, source.random)
    game.store.getState().startBattle()
    game.store.getState().stopBattle()
    if (shortSteps) {
      for (let time = 100; time <= 60000; time += 100) game.advanceTo(time)
    } else game.advanceTo(60000)
    const state = game.store.getState()
    game.advanceTo(120000)
    assert.equal(source.count(), 9)
    assert.match(state.obtainedItems, /木剑.*精铁剑/)
    assert.equal(state.inventory.items.find((item) => item.id.endsWith('drop-1'))!.qualityLabel, '优秀')
    assert.deepEqual(state.inventory.items.find((item) => item.id.endsWith('drop-1'))!.additionalBonuses, ['物理防御 +1'])
    return { inventory: state.inventory, logs: state.battle.logs, stats: state.character.stats }
  }
  assert.deepEqual(play(true), play(false))
})

test('初始赠送装备保持预设品质且不生成极品，怪物页面读取概率不抽奖', () => {
  const world = createLocalWorld()
  assert.equal(world.character.items.find((item) => item.definitionId === 'iron-sword')!.quality, 'uncommon')
  assert.ok(world.character.items.every((item) => Object.keys(item.additionalStats).length === 0))
  assert.equal(readMonsterInfo(world.monster).fields.at(-1)!.value, '狼牙 × 1（100%）、木剑 × 1（30%）、精铁剑 × 1（10%）')
})
