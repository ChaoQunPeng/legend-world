import assert from 'node:assert/strict'
import { test } from 'node:test'
import { Inventory, Item, CombatSession } from '../src/core'
import type { ItemDefinition } from '../src/core'
import { createLocalWorld } from '../src/game/data/localWorld'
import { readInventory } from '../src/game/panels/inventory'
import { createGameStore } from '../src/stores/gameStore'

const material: ItemDefinition = { id: 'test-ore', name: '矿石', type: 'material', quality: 'normal', maxStack: 99 }
const potion: ItemDefinition = { id: 'test-potion', name: '小生命药水', type: 'consumable', quality: 'normal', maxStack: 20, effect: { type: 'heal', target: 'self', amount: 50 } }
const sword: ItemDefinition = { id: 'test-sword', name: '测试剑', type: 'equipment', quality: 'normal', equipment: { requirements: { level: 1, classes: [] }, slot: 'weapon', stats: { attack: 5 } } }

/** 用独立装备填充剩余格子，验证真实三十格边界而不更改正式容量。 */
function fillInventory(character: ReturnType<typeof createLocalWorld>['character']): void {
  const remaining = character.inventoryCapacity - character.items.length
  for (let index = 0; index < remaining; index += 1) character.receiveItem(new Item(`filler-${index}`, sword))
}

/** 清空本地初始背包，方便仅通过公开角色方法准备数量场景。 */
function emptyCharacter() {
  const { character } = createLocalWorld()
  for (const item of character.items) character.discardItem(item.id, item.quantity)
  return character
}

test('材料与药水按 99 和 20 分格，装备同定义仍保留各自原实例', () => {
  const inventory = new Inventory()
  inventory.receive(new Item('ore', material, 200))
  inventory.receive(new Item('potion', potion, 41))
  const first = new Item('sword-one', sword)
  const second = new Item('sword-two', sword)
  inventory.receive(first)
  inventory.receive(second)
  assert.deepEqual(inventory.items.map((item) => item.quantity), [99, 99, 2, 20, 20, 1, 1, 1])
  assert.strictEqual(inventory.items[6], first)
  assert.strictEqual(inventory.items[7], second)
  assert.equal(new Set(inventory.items.map((item) => item.id)).size, 8)
})

test('满包仍补已有堆叠，仅无法放入的数量进入待领取；手动领取可分次完成', () => {
  const character = emptyCharacter()
  character.receiveItem(new Item('ore-first', material, 98))
  fillInventory(character)
  assert.deepEqual(character.receiveItem(new Item('ore-more', material, 101)), { received: 1, pending: 100 })
  assert.equal(character.items.length, 30)
  assert.equal(character.items[0].quantity, 99)
  const pending = character.pendingItems[0]
  assert.equal(pending.quantity, 100)
  assert.deepEqual(character.claimItem(pending.id), { received: 0, pending: 100 })
  character.discardItem(character.items[1].id, 1)
  assert.equal(character.pendingItems[0].quantity, 100, '腾出空间不会自动领取')
  assert.deepEqual(character.claimItem(pending.id), { received: 99, pending: 1 })
  character.discardItem(character.items[0].id, 1)
  assert.deepEqual(character.claimItem(pending.id), { received: 1, pending: 0 })
  assert.equal(character.pendingItems.length, 0)
  assert.deepEqual(character.claimItem(pending.id), { received: 0, pending: 0 })
  assert.equal(character.items.filter((item) => item.definitionId === material.id).reduce((sum, item) => sum + item.quantity, 0), 198)
})

test('满包不影响击杀经验和升级，待领取掉落只发一次', () => {
  const world = createLocalWorld()
  fillInventory(world.character)
  const session = new CombatSession(world.character, world.monster, () => 0.99)
  session.start()
  session.advanceTo(60000)
  assert.equal(world.character.level, 2)
  assert.equal(world.character.experience, 20)
  assert.equal(world.character.items.length, 30)
  assert.equal(world.character.pendingItems[0].name, '狼牙')
  const end = session.records.at(-1)
  assert.equal(end?.type, 'end')
  if (end?.type === 'end') assert.equal(end.pendingItemCount, 1)
  session.advanceTo(120000)
  assert.equal(world.character.pendingItems.length, 1)
  assert.equal(world.character.experience, 20)
})

test('满包换装保留双方原实例，满包卸装失败后可腾格再卸', () => {
  const character = emptyCharacter()
  const first = new Item('first', sword)
  const second = new Item('second', sword)
  character.receiveItem(first)
  character.equip(first.id)
  character.receiveItem(second)
  fillInventory(character)
  character.equip(second.id)
  assert.strictEqual(character.equipment.get('weapon'), second)
  assert.strictEqual(character.items.find((item) => item.id === first.id), first)
  assert.equal(character.stats.attack, 23)
  assert.equal(character.pendingItems.length, 0)
  assert.equal(character.unequip('weapon'), false)
  assert.strictEqual(character.equipment.get('weapon'), second)
  character.discardItem(first.id, 1)
  assert.equal(character.unequip('weapon'), true)
  assert.strictEqual(character.items.find((item) => item.id === second.id), second)
  assert.equal(character.stats.attack, 18)
})

test('待领取装备重复尝试不会改变实例身份，腾格后原实例入包', () => {
  const character = emptyCharacter()
  fillInventory(character)
  const item = new Item('waiting-sword', sword)
  character.receiveItem(item)
  character.claimItem(item.id)
  assert.strictEqual(character.pendingItems[0], item)
  character.discardItem(character.items[0].id, 1)
  character.claimItem(item.id)
  assert.strictEqual(character.items.find((entry) => entry.id === item.id), item)
})

test('丢弃按格扣数量，整格移除释放空间，无效数量和重复操作不改数量', () => {
  const character = emptyCharacter()
  character.receiveItem(new Item('ore', material, 3))
  const id = character.items[0].id
  for (const invalid of [0, -1, 4, 1.5]) assert.equal(character.discardItem(id, invalid), false)
  assert.equal(character.discardItem(id, 2), true)
  assert.equal(character.items[0].quantity, 1)
  assert.equal(character.discardItem(id, 1), true)
  assert.equal(character.items.length, 0)
  assert.equal(character.discardItem(id, 1), false)
})

test('药水复用即时恢复，恢复不超上限，成功才扣数量，耗尽后释放格子', () => {
  const character = emptyCharacter()
  character.receiveItem(new Item('potion', potion, 2))
  const id = character.items[0].id
  assert.equal(character.useItem(id), undefined)
  assert.equal(character.items[0].quantity, 2)
  character.takeDamage(80)
  assert.deepEqual(character.useItem(id), { type: 'heal', targetId: character.id, amount: 50 })
  assert.equal(character.health, 90)
  assert.equal(character.items[0].quantity, 1)
  assert.equal(character.useItem(id)?.amount, 30)
  assert.equal(character.health, 120)
  assert.equal(character.items.length, 0)
  assert.equal(character.useItem(id), undefined)
})

test('死亡不能用药复活，材料不能使用，失败不消耗', () => {
  const character = emptyCharacter()
  character.receiveItem(new Item('potion', potion))
  character.receiveItem(new Item('ore', material))
  character.takeDamage(10)
  assert.equal(character.useItem(character.items[1].id), undefined)
  character.takeDamage(110)
  assert.equal(character.useItem(character.items[0].id), undefined)
  assert.equal(character.health, 0)
  assert.deepEqual(character.items.map((item) => item.quantity), [1, 1])
})

test('战斗中用药同步页面快照且不重开战斗，穿脱后仍读取最新属性', () => {
  const world = createLocalWorld()
  const game = createGameStore(world, () => 0, () => 0.99)
  game.store.getState().startBattle()
  game.store.getState().stopBattle()
  game.advanceTo(1000)
  assert.equal(game.store.getState().character.health, 114)
  const potionView = game.store.getState().inventory.items.find((item) => item.type === 'consumable')!
  assert.equal(potionView.canUse, true)
  game.store.getState().useItem(potionView.id)
  assert.equal(game.store.getState().character.health, 120)
  assert.equal(game.store.getState().inventory.items.find((item) => item.id === potionView.id)?.quantity, 4)
  assert.equal(game.store.getState().battle.status, 'running')
  assert.match(game.store.getState().inventoryMessage, /恢复 6 生命/)
  const weapon = world.character.items.find((item) => item.definitionId === 'wood-sword')!
  game.store.getState().equipItem(weapon.id)
  game.advanceTo(2000)
  assert.equal(game.store.getState().battle.lastAction?.damage, 21)
})

test('背包快照逐格展示数量、容量、待领取列表，仓库操作及时更新提示', () => {
  const world = createLocalWorld()
  world.character.receiveItem(new Item('many-potions', potion, 21))
  const game = createGameStore(world, () => 0, () => 0.99)
  const view = readInventory(world.character)
  assert.equal(view.capacity, 30)
  assert.deepEqual(view.items.filter((item) => item.name === '小生命药水').map((item) => item.quantity), [5, 20, 1])
  fillInventory(world.character)
  world.character.receiveItem(new Item('pending-ore', material))
  game.store.getState().claimItem(world.character.pendingItems[0].id)
  assert.match(game.store.getState().inventoryMessage, /剩余 1 件待领取/)
  const filler = world.character.items.find((item) => item.id === 'filler-0')!
  game.store.getState().discardItem(filler.id, 1)
  assert.equal(game.store.getState().inventory.usedSlots, 29)
  const pending = game.store.getState().inventory.pendingItems[0]
  game.store.getState().claimItem(pending.id)
  assert.equal(game.store.getState().inventory.pendingItems.length, 0)
  assert.equal(game.store.getState().inventory.usedSlots, 30)
  assert.match(game.store.getState().inventoryMessage, /已领取 1 件/)
})
