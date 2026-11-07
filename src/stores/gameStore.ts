import { createStore } from 'zustand/vanilla'
import { CombatSession } from '../core'
import type { CombatRecord, CombatStatus, DamageRecord, EquipmentSlot } from '../core'
import type { LocalWorld } from '../game/data/localWorld'
import { readCharacterInfo, readMonsterInfo } from '../game/panels/unitInfo'
import type { UnitInfo } from '../game/panels/unitInfo'
import { readInventory } from '../game/panels/inventory'
import type { InventoryView } from '../game/panels/inventory'

/** UI 直接消费战斗展示数据，不在组件内查询、解释战斗记录。 */
interface BattleView {
  readonly status: CombatStatus
  readonly statusLabel: string
  readonly buttonLabel: string
  readonly canStart: boolean
  readonly characterHit: DamageRecord | undefined
  readonly monsterHit: DamageRecord | undefined
  readonly lastAction: DamageRecord | undefined
  readonly logs: readonly { id: number; timeSeconds: number; text: string; isResult: boolean }[]
}

/** 业务快照与操作统一对外提供，替换 React 或临时面板不改变业务流程。 */
export interface GameState {
  readonly character: UnitInfo
  readonly monster: UnitInfo
  readonly experience: number
  readonly obtainedItems: string
  readonly battle: BattleView
  readonly inventory: InventoryView
  readonly equipItem: (itemId: string) => void
  readonly unequipItem: (slot: EquipmentSlot) => void
  readonly startBattle: () => void
}

const statusLabels: Record<CombatStatus, string> = {
  idle: '准备就绪', running: '战斗进行中', victory: '战斗胜利', defeat: '战斗失败',
}

/** 结构化战斗记录转为可读日志，胜利对象来自当前世界而非写死的怪物名。 */
function describeRecord(record: CombatRecord, monsterName: string): string {
  if (record.type === 'damage') {
    return `${record.attackerName}使用${record.actionName}，对${record.targetName}造成 ${record.damage} 点伤害，剩余生命 ${record.targetHealth}。`
  }
  if (record.outcome === 'defeat') return '角色倒下，战斗结束，本场未获得奖励。'
  const drops = record.items.map((item) => `${item.name} × 1`).join('、')
  return `击败${monsterName}！获得 ${record.experience} 经验${drops ? `、${drops}` : ''}。`
}

/** 聚合日志和最近受击记录，组件只渲染结果，动画仍使用原始记录 ID。 */
function readBattleView(session: CombatSession, world: LocalWorld): BattleView {
  const records = session.records
  const status = session.status
  return {
    status, statusLabel: statusLabels[status], canStart: status === 'idle',
    buttonLabel: status === 'idle' ? '开始战斗' : status === 'running' ? '交战中…' : '本场已结束',
    characterHit: records.findLast((record): record is DamageRecord => record.type === 'damage' && record.targetId === world.character.id),
    monsterHit: records.findLast((record): record is DamageRecord => record.type === 'damage' && record.targetId === world.monster.id),
    lastAction: records.findLast((record): record is DamageRecord => record.type === 'damage' && record.attackerId === world.character.id),
    logs: records.toReversed().map((record) => ({
      id: record.id, timeSeconds: record.timeMs / 1000,
      text: describeRecord(record, world.monster.name), isResult: record.type === 'end',
    })),
  }
}

/** 每个世界独立创建仓库；快照始终读取场景与战斗共用的真实单位实例。 */
export function createGameStore(world: LocalWorld) {
  const session = new CombatSession(world.character, world.monster)

  /** 战斗推进和穿脱装备时统一重读模型，保持属性、背包和战斗奖励同步。 */
  function readWorld() {
    return {
      character: readCharacterInfo(world.character), monster: readMonsterInfo(world.monster),
      experience: world.character.experience,
      obtainedItems: session.records.filter((record) => record.type === 'end').flatMap((record) => record.items).map((item) => `${item.name} × 1`).join('、') || '暂无',
      inventory: readInventory(world.character),
      battle: readBattleView(session, world),
    }
  }

  const store = createStore<GameState>(() => ({
    ...readWorld(),
    /** 穿戴或替换装备后同步发布背包、装备栏和角色最终属性。 */
    equipItem: (itemId) => {
      world.character.equip(itemId)
      refresh()
    },
    /** 卸下装备回包，下一次战斗行动立即使用更新后的属性。 */
    unequipItem: (slot) => {
      world.character.unequip(slot)
      refresh()
    },
    /** 开始约束由核心协调器保证，重复调用不会重开或重复结算。 */
    startBattle: () => {
      if (session.start()) refresh()
    },
  }))

  /** 一次发布全部快照，常驻面板与血条、装备和奖励保持同一时间点。 */
  function refresh(): void {
    store.setState(readWorld())
  }

  /** 核心仍只接收逻辑时间；浏览器或其他宿主可以使用相同入口推进战斗。 */
  function advanceTo(elapsedMs: number): void {
    const recordCount = session.records.length
    session.advanceTo(elapsedMs)
    if (session.records.length !== recordCount) refresh()
  }

  return { store, advanceTo }
}

/** 浏览器时钟适配层：战斗开始时计时，结束或宿主卸载时释放定时器及订阅。 */
export function connectBattleClock(game: ReturnType<typeof createGameStore>): () => void {
  let timer: ReturnType<typeof setInterval> | undefined

  /** 仅运行中的战斗需要采样；穿脱装备与面板更新不会重置战斗起始时间。 */
  function syncClock(): void {
    if (game.store.getState().battle.status === 'running') {
      if (timer !== undefined) return
      const startedAt = performance.now()
      timer = setInterval(() => game.advanceTo(performance.now() - startedAt), 100)
    } else {
      clearInterval(timer)
      timer = undefined
    }
  }

  const unsubscribe = game.store.subscribe(syncClock)
  syncClock()
  return () => {
    unsubscribe()
    clearInterval(timer)
  }
}
