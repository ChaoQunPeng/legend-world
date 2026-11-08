import assert from 'node:assert/strict'
import { test } from 'node:test'
import { Battle, CombatSession, Item, Monster } from '../src/core'
import type { SkillDefinition } from '../src/core'
import { createLocalWorld } from '../src/game/data/localWorld'
import { localSkills } from '../src/game/data/localSkills'
import { readMonsterInfo } from '../src/game/panels/unitInfo'

test('野狼零魔法也能撕咬，首次可用，三秒冷却期间按规则普攻', () => {
  const world = createLocalWorld()
  const session = new CombatSession(world.character, world.monster, () => 0.99)
  session.start()
  session.advanceTo(4000)
  const actions = session.records.filter((record) => record.type === 'damage' && record.attackerId === world.monster.id)
  assert.deepEqual(actions.map((record) => [record.timeMs, record.actionName, record.damage, record.hit]), [
    [1000, '撕咬', 6, true], [2000, '普通攻击', 2, true],
    [3000, '普通攻击', 2, true], [4000, '撕咬', 6, true],
  ])
  assert.equal(world.monster.mana, 0)
  assert.equal(world.character.health, 104)
  const info = readMonsterInfo(world.monster)
  assert.equal(info.fields.find((field) => field.label === '技能优先级')!.value, '撕咬')
  assert.match(String(info.fields.find((field) => field.label === '技能 · 撕咬')!.value), /耗魔 0 · 冷却 3 秒 · 本次物攻 \+4/)
})

test('同一怪物配置创建的独立实例在同场协调器内也不共享冷却', () => {
  const first = createLocalWorld()
  const second = createLocalWorld()
  const battle = new Battle(() => 0.99)
  assert.equal(battle.castSkill(first.monster, first.character, first.monster.skills[0], 1000).success, true)
  assert.equal(battle.getRemainingCooldown(first.monster, first.monster.skills[0], 1000), 3000)
  assert.equal(battle.getRemainingCooldown(second.monster, second.monster.skills[0], 1000), 0)
  assert.equal(battle.castSkill(second.monster, second.character, second.monster.skills[0], 1000).success, true)
  assert.equal(first.character.health, 114)
  assert.equal(second.character.health, 114)
})

test('怪物按列表优先尝试技能，魔法不足或冷却时尝试后续，均不可用才普攻', () => {
  const world = createLocalWorld()
  const skills: readonly SkillDefinition[] = [
    { ...localSkills.wolfBite, id: 'mana-bite', name: '耗魔撕咬', manaCost: 1 },
    localSkills.wolfBite,
    { ...localSkills.wolfBite, id: 'second-bite', name: '次要撕咬' },
  ]
  world.monster = new Monster('priority-wolf', {
    id: 'priority-wolf', name: '优先级野狼', rank: 'normal', level: 1, skills,
    stats: { ...world.monster.stats, maxHealth: 1000 }, rewards: { experience: 20, drops: [] },
  })
  const session = new CombatSession(world.character, world.monster, () => 0.99)
  session.start()
  session.advanceTo(4000)
  assert.deepEqual(session.records.filter((record) => record.type === 'damage' && record.attackerId === world.monster.id).map((record) => record.actionName), ['撕咬', '次要撕咬', '普通攻击', '撕咬'])
  assert.equal(world.monster.mana, 0)
})

test('角色先手击杀后野狼不再撕咬，结算与后续推进不重复行动或发奖', () => {
  const world = createLocalWorld()
  const sword = new Item('killing-sword', { id: 'killing-sword', name: '击杀验证剑', type: 'equipment', quality: 'normal', equipment: { slot: 'weapon', stats: { attack: 100 }, requirements: { level: 1, classes: [] } } })
  world.character.receiveItem(sword)
  world.character.equip(sword.id)
  const session = new CombatSession(world.character, world.monster, () => 0.99)
  session.start()
  session.advanceTo(1000)
  assert.equal(session.status, 'victory')
  assert.equal(session.records.filter((record) => record.type === 'damage' && record.attackerId === world.monster.id).length, 0)
  const records = session.records
  session.advanceTo(60000)
  assert.deepEqual(session.records, records)
  assert.equal(world.character.experience, 20)
})

test('怪物物理技能未命中仍进入冷却，下一秒按策略普攻', () => {
  const world = createLocalWorld()
  world.monster = new Monster('missing-wolf', {
    id: 'missing-wolf', name: '命中验证野狼', rank: 'normal', level: 1,
    skills: [localSkills.wolfBite], stats: { ...world.monster.stats, hitRate: 0.5 },
    rewards: { experience: 20, drops: [] },
  })
  const values = [0.8, 0.2, 0.2, 0.2]
  let calls = 0
  const session = new CombatSession(world.character, world.monster, () => {
    assert.ok(calls < values.length)
    return values[calls++]
  })
  session.start()
  session.advanceTo(4000)
  assert.deepEqual(session.records.filter((record) => record.type === 'damage' && record.attackerId === world.monster.id).map((record) => [record.actionName, record.hit, record.damage]), [
    ['撕咬', false, 0], ['普通攻击', true, 2], ['普通攻击', true, 2], ['撕咬', true, 6],
  ])
  assert.equal(world.character.health, 110)
  assert.equal(calls, 4)
})
