import { createStore } from 'zustand/vanilla'
import { CombatSession } from '../core'
import type { CombatRecord, CombatStatus, DamageRecord } from '../core'
import type { LocalWorld } from '../game/data/localWorld'
import { readCharacterInfo, readMonsterInfo } from '../game/panels/unitInfo'
import type { UnitInfo } from '../game/panels/unitInfo'

/** 当前本地世界只有一名角色和一只怪物，面板一次查看其中一个单位。 */
export type InfoPanelTarget = 'character' | 'monster'

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
  readonly panelTarget: InfoPanelTarget | null
  readonly panel: UnitInfo | null
  readonly openPanel: (target: InfoPanelTarget) => void
  readonly closePanel: () => void
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
  const session = new CombatSession(world.character, world.monster, world.skill)

  /** 战斗推进和打开面板时统一重读模型，避免缓存首次打开时的生命或经验。 */
  function readWorld() {
    return {
      character: readCharacterInfo(world.character), monster: readMonsterInfo(world.monster),
      experience: world.character.experience,
      obtainedItems: world.character.items.length === 0 ? '暂无' : world.character.items.map((item) => `${item.name} × 1`).join('、'),
      battle: readBattleView(session, world),
    }
  }

  const store = createStore<GameState>((set) => ({
    ...readWorld(), panelTarget: null, panel: null,
    /** 面板切换只读取信息，不启动战斗，也不修改单位状态。 */
    openPanel: (target) => {
      const snapshot = readWorld()
      set({ ...snapshot, panelTarget: target, panel: snapshot[target] })
    },
    /** 关闭后保留单位与战斗进度，下次打开重新读取当前信息。 */
    closePanel: () => set({ panelTarget: null, panel: null }),
    /** 开始约束由核心协调器保证，重复调用不会重开或重复结算。 */
    startBattle: () => {
      if (session.start()) refresh()
    },
  }))

  /** 一次发布战斗和单位快照，打开的面板与血条、奖励保持同一时间点。 */
  function refresh(): void {
    const snapshot = readWorld()
    const target = store.getState().panelTarget
    store.setState({ ...snapshot, panel: target === null ? null : snapshot[target] })
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

  /** 仅运行中的战斗需要采样；面板开关不会重置战斗起始时间。 */
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
