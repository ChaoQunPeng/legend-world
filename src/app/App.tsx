import { useEffect, useState } from 'react'
import { CombatantCard } from '../components/CombatantCard'
import { GameCanvas } from '../components/GameCanvas'
import { createLocalWorld } from '../game/data/localWorld'
import { CombatSession } from '../core'
import type { CombatRecord, CombatStatus, DamageRecord } from '../core'

/** 将模型枚举映射为页面中的中文身份说明。 */
const classLabels = { warrior: '战士', mage: '法师', taoist: '道士' }
const rankLabels = { normal: '普通', elite: '精英', boss: '首领' }
const statusLabels: Record<CombatStatus, string> = {
  idle: '准备就绪', running: '战斗进行中', victory: '战斗胜利', defeat: '战斗失败',
}

/** 将核心结构化记录转换为玩家可读的战斗信息。 */
function describeRecord(record: CombatRecord): string {
  if (record.type === 'damage') {
    return `${record.attackerName}使用${record.actionName}，对${record.targetName}造成 ${record.damage} 点伤害，剩余生命 ${record.targetHealth}。`
  }
  if (record.outcome === 'defeat') return '角色倒下，战斗结束，本场未获得奖励。'
  return `击败野狼！获得 ${record.experience} 经验、${record.items.map((item) => item.name).join('、')} × 1。`
}

/** 每次从记录中找到单位最近一次受击，用记录 ID 重新播放伤害数字动画。 */
function findLatestHit(records: readonly CombatRecord[], targetId: string): DamageRecord | undefined {
  return records.findLast((record): record is DamageRecord => record.type === 'damage' && record.targetId === targetId)
}

/** 传奇世界入口：DOM 展示标题，PixiJS 独立管理游戏世界。 */
export default function App() {
  // 同一次页面挂载共用一组本地实例，普通重渲染不重置单位状态。
  const [localWorld] = useState(createLocalWorld)
  const { character, monster, skill } = localWorld
  const [session] = useState(() => new CombatSession(character, monster, skill))
  const [battleView, setBattleView] = useState<{ status: CombatStatus; records: readonly CombatRecord[] }>({
    status: session.status, records: session.records,
  })

  useEffect(() => {
    if (battleView.status !== 'running') return
    // 浏览器只提供经过的毫秒数；行动顺序、技能冷却和胜负完全由核心决定。
    const startedAt = performance.now()
    let recordCount = session.records.length
    const timer = window.setInterval(() => {
      session.advanceTo(performance.now() - startedAt)
      const records = session.records
      // 定时器只采样时间，产生新记录后才刷新界面，避免空闲采样引起重渲染。
      if (records.length === recordCount) return
      recordCount = records.length
      setBattleView({ status: session.status, records })
    }, 100)
    return () => window.clearInterval(timer)
  }, [battleView.status, session])

  /** 状态在核心内同步切换，连续点击也不会启动第二场或重复发放奖励。 */
  function startBattle(): void {
    if (session.start()) setBattleView({ status: session.status, records: session.records })
  }

  const lastAction = battleView.records.findLast((record): record is DamageRecord => record.type === 'damage' && record.attackerId === character.id)

  return (
    <main className="world">
      <GameCanvas localWorld={localWorld} />
      <header className="world__header">
        <p className="world__eyebrow" lang="en">LEGEND WORLD</p>
        <h1>传奇世界</h1>
        <p className="world__message">山海之间，传奇初启。</p>
      </header>
      <div className="world__battle-panel">
        <section className="battle-controls" aria-label="战斗控制">
          <div>
            <p className="battle-controls__status" role="status">{statusLabels[battleView.status]}</p>
            <p className="battle-controls__hint">每秒行动 · 角色先手 · 自动优先释放重击</p>
          </div>
          <button type="button" onClick={startBattle} disabled={battleView.status !== 'idle'}>
            {battleView.status === 'idle' ? '开始战斗' : battleView.status === 'running' ? '交战中…' : '本场已结束'}
          </button>
        </section>
        {lastAction && <p key={lastAction.id} className="battle-action">{lastAction.attackerName} · {lastAction.actionName} <strong>{lastAction.damage} 伤害</strong></p>}
        <section className="world__units" aria-label="本地角色与怪物">
          <CombatantCard combatant={character} category="角色" detail={`Lv.${character.level} · ${classLabels[character.characterClass]}`} hit={findLatestHit(battleView.records, character.id)} />
          <CombatantCard combatant={monster} category="怪物" detail={`Lv.${monster.level} · ${rankLabels[monster.rank]}`} hit={findLatestHit(battleView.records, monster.id)} />
        </section>
        <section className="battle-rewards" aria-label="经验和战利品">
          <span>累计经验 <strong>{character.experience}</strong></span>
          <span>获得物品 <strong>{character.items.length === 0 ? '暂无' : character.items.map((item) => `${item.name} × 1`).join('、')}</strong></span>
        </section>
        <section className="battle-log" aria-label="战斗日志">
          <h2>战斗记录</h2>
          <ol>
            {battleView.records.length === 0 && <li>点击开始战斗，挑战野狼。胜利奖励：20 经验、狼牙 × 1。</li>}
            {battleView.records.toReversed().map((record) => (
              <li key={record.id} className={record.type === 'end' ? 'battle-log__result' : ''}>
                <time>{record.timeMs / 1000}s</time>{describeRecord(record)}
              </li>
            ))}
          </ol>
        </section>
        <p className="battle-note">本地单场战斗 · 暂不升级或自动续战 · 刷新页面重新开始</p>
      </div>
    </main>
  )
}
