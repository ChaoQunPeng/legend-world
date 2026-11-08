import { createStore } from 'zustand/vanilla'
import { IdleCombatSession } from '../core'
import type { CombatRecord, CombatStatus, IdleCombatPhase, DamageRecord, EquipmentSlot, RandomSource } from '../core'
import type { LocalWorld } from '../game/data/localWorld'
import { readCharacterInfo, readCharacterGrowth, readMonsterInfo } from '../game/panels/unitInfo'
import type { CharacterGrowthView, UnitInfo } from '../game/panels/unitInfo'
import { describeEquipFailure, readInventory } from '../game/panels/inventory'
import type { InventoryView } from '../game/panels/inventory'
import { describeLearnFailure, readSkillBook } from '../game/panels/skills'
import type { SkillBookView } from '../game/panels/skills'

/** UI 直接消费战斗展示数据，不在组件内查询、解释战斗记录。 */
interface BattleView {
  readonly status: CombatStatus
  readonly statusLabel: string
  readonly buttonLabel: string
  readonly phase: IdleCombatPhase
  readonly canStop: boolean
  readonly canRevive: boolean
  readonly isActive: boolean
  readonly stopRequested: boolean
  readonly battleNumber: number
  readonly kills: number
  readonly waitRemainingSeconds: string
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
  readonly growth: CharacterGrowthView
  readonly obtainedItems: string
  readonly battle: BattleView
  readonly inventory: InventoryView
  readonly equipItem: (itemId: string) => void
  readonly unequipItem: (slot: EquipmentSlot) => void
  readonly inventoryMessage: string
  readonly discardItem: (itemId: string, quantity: number) => void
  readonly useItem: (itemId: string) => void
  readonly claimItem: (itemId: string) => void
  readonly startBattle: () => void
  readonly stopBattle: () => void
  readonly revive: () => void
  readonly skillBook: SkillBookView
  readonly skillMessage: string
  readonly learnSkill: (skillId: string) => void
}

const phaseLabels: Record<IdleCombatPhase, string> = {
  idle: '准备就绪', fighting: '战斗进行中', waiting: '胜利，等待下一场', stopped: '挂机已停止', dead: '角色死亡，挂机已停止',
}

/** 结构化战斗记录转为可读日志，胜利对象来自当前世界而非写死的怪物名。 */
function describeRecord(record: CombatRecord, monsterName: string): string {
  if (record.type === 'damage') {
    if (!record.hit) return `${record.attackerName}使用${record.actionName}，未命中${record.targetName}。`
    return `${record.attackerName}使用${record.actionName}，对${record.targetName}造成 ${record.damage} 点伤害，剩余生命 ${record.targetHealth}。`
  }
  if (record.outcome === 'defeat') return '角色倒下，战斗结束，本场未获得奖励。'
  const drops = record.items.map((item) => `${item.name} × 1`).join('、')
  const growth = record.growth
  const levelUp = growth && growth.level > growth.previousLevel
    ? ` 升级！Lv.${growth.previousLevel} → Lv.${growth.level}，生命和魔法已回满。`
    : ''
  const pending = record.pendingItemCount > 0 ? ` 背包空间不足，${record.pendingItemCount} 件掉落待领取。` : ''
  return `击败${monsterName}！获得 ${record.experience} 经验${drops ? `、${drops}` : ''}。${pending}${levelUp}`
}

/** 聚合日志和最近受击记录，组件只渲染结果，动画仍使用原始记录 ID。 */
function readBattleView(session: IdleCombatSession, world: LocalWorld): BattleView {
  const records = session.records
  const status = session.status
  return {
    status, phase: session.phase,
    statusLabel: session.stopRequested && session.phase === 'fighting' ? '战斗进行中，本场结束后停止' : phaseLabels[session.phase],
    canStart: !session.isActive && session.phase !== 'dead',
    canStop: session.isActive && !session.stopRequested,
    canRevive: session.phase === 'dead', isActive: session.isActive,
    stopRequested: session.stopRequested, battleNumber: session.battleNumber, kills: session.kills,
    waitRemainingSeconds: (session.waitRemainingMs / 1000).toFixed(1),
    buttonLabel: '开始挂机',
    // 历史日志跨场保留，当前战斗提示只读取本只怪物的记录，刷新后不沿用旧伤害摘要。
    characterHit: records.findLast((record): record is DamageRecord => record.type === 'damage' && record.targetId === world.character.id && record.attackerId === world.monster.id),
    monsterHit: records.findLast((record): record is DamageRecord => record.type === 'damage' && record.targetId === world.monster.id),
    lastAction: records.findLast((record): record is DamageRecord => record.type === 'damage' && record.attackerId === world.character.id && record.targetId === world.monster.id),
    logs: records.toReversed().map((record) => ({
      id: record.id, timeSeconds: record.timeMs / 1000,
      text: describeRecord(record, world.monster.name), isResult: record.type === 'end',
    })),
  }
}

/** 每个世界独立创建仓库；宿主提供毫秒时钟与随机源，测试可替换为确定输入。 */
export function createGameStore(world: LocalWorld, now: () => number = () => 0, random: RandomSource = Math.random) {
  const session = new IdleCombatSession(world.character, world.monster, world.createMonster, random)
  let startedAt = 0
  let segmentStartedAt = 0

  /** 战斗推进和穿脱装备时统一重读模型，保持属性、背包和战斗奖励同步。 */
  function readWorld() {
    world.monster = session.monster
    return {
      character: readCharacterInfo(world.character), monster: readMonsterInfo(world.monster),
      experience: world.character.experience,
      growth: readCharacterGrowth(world.character),
      obtainedItems: (session.records.findLast((record) => record.type === 'end')?.items ?? []).map((item) => `${item.name} × 1`).join('、') || '暂无',
      inventory: readInventory(world.character),
      skillBook: readSkillBook(world.character),
      battle: readBattleView(session, world),
    }
  }

  const store = createStore<GameState>(() => ({
    ...readWorld(),
    inventoryMessage: '',
    skillMessage: '',
    /** 战斗中的学习由核心拒绝；先同步时间，使已结束的战斗能及时解除学习锁定。 */
    learnSkill: (skillId) => {
      synchronizeTime()
      const result = world.character.learnSkill(skillId)
      refresh()
      const name = world.character.skillCatalog.find((entry) => entry.skill.id === skillId)?.skill.name
      store.setState({ skillMessage: result.success ? `已学会${name}。` : `无法学习：${describeLearnFailure(result.reason)}。` })
    },
    /** 穿戴或替换装备后同步发布背包、装备栏和角色最终属性。 */
    equipItem: (itemId) => {
      synchronizeTime()
      const check = world.character.equip(itemId)
      refresh()
      store.setState({ inventoryMessage: check.canEquip ? '已穿戴装备，后续行动使用新属性。' : `无法穿戴：${describeEquipFailure(check.reason)}。` })
    },
    /** 卸下装备回包，下一次战斗行动立即使用更新后的属性。 */
    unequipItem: (slot) => {
      synchronizeTime()
      const success = world.character.unequip(slot)
      refresh()
      store.setState({ inventoryMessage: success ? '装备已卸下并放回背包。' : '背包已满，请先腾出一格再卸下装备。' })
    },
    /** 丢弃完成后同步容量，待领取掉落仍需手动领取。 */
    discardItem: (itemId, quantity) => {
      const success = world.character.discardItem(itemId, quantity)
      refresh()
      store.setState({ inventoryMessage: success ? `已丢弃 ${quantity} 件物品。` : '丢弃失败，请检查当前数量。' })
    },
    /** 药水不暂停战斗；生命、数量与可用状态同次刷新。 */
    useItem: (itemId) => {
      // 用药也会改变战斗结果，与换装遵循同一操作时序，不能治疗已结算死亡的角色。
      synchronizeTime()
      const result = world.character.useItem(itemId)
      refresh()
      store.setState({ inventoryMessage: result ? `已使用药水，恢复 ${result.amount} 生命。` : '仅存活且未满血时可使用药水。' })
    },
    /** 部分领取时保留剩余掉落，并明确告知玩家本次入包数量。 */
    claimItem: (itemId) => {
      const result = world.character.claimItem(itemId)
      refresh()
      store.setState({ inventoryMessage: result.pending > 0 ? `已领取 ${result.received} 件，剩余 ${result.pending} 件待领取，请腾出空间。` : `已领取 ${result.received} 件物品。` })
    },
    /** 停止请求由核心协调器处理，战斗中仍推进至当前场结算。 */
    stopBattle: () => {
      // 请求时先结算历史行动，不能把已经结束的战斗重新视为正在战斗。
      synchronizeTime()
      session.stop()
      refresh()
    },
    /** 复活恢复资源但不启动时钟，保留成长与背包。 */
    revive: () => {
      session.revive()
      refresh()
    },
    /** 开始新的宿主时钟段，停止期间的墙钟时间不计入战斗或等待。 */
    startBattle: () => {
      if (session.start()) {
        startedAt = now()
        segmentStartedAt = session.elapsedMs
        store.setState({ skillMessage: '' })
        refresh()
      }
    },
  }))

  /** 一次发布全部快照，常驻面板与血条、装备和奖励保持同一时间点。 */
  function refresh(): void {
    store.setState(readWorld())
  }

  /** 核心仍只接收逻辑时间；浏览器或其他宿主可以使用相同入口推进战斗。 */
  function advanceTo(elapsedMs: number): void {
    session.advanceTo(elapsedMs)
    refresh()
  }

  /** 同时刻先结算整轮双方行动，再执行换装或用药；延迟采样不会把新属性用于旧行动。 */
  function synchronizeTime(): void {
    if (session.isActive) advanceTo(segmentStartedAt + now() - startedAt)
  }

  return { store, advanceTo, synchronizeTime }
}

/** 浏览器时钟适配层：战斗与等待持续采样，停止、死亡或宿主卸载时释放定时器。 */
export function connectBattleClock(game: ReturnType<typeof createGameStore>): () => void {
  let timer: ReturnType<typeof setInterval> | undefined

  /** 运行中的战斗与等待需要采样；穿脱装备与面板更新不会重置战斗起始时间。 */
  function syncClock(): void {
    if (game.store.getState().battle.isActive) {
      if (timer !== undefined) return
      timer = setInterval(game.synchronizeTime, 100)
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
