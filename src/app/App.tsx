import { useEffect, useState } from 'react'
import { useStore } from 'zustand'
import { CombatantCard } from '../components/CombatantCard'
import { UnitInfoPanel } from '../components/UnitInfoPanel'
import { GameCanvas } from '../components/GameCanvas'
import { createLocalWorld } from '../game/data/localWorld'
import { connectBattleClock, createGameStore } from '../stores/gameStore'

/** 临时游戏入口只连接生命周期和渲染快照，战斗及面板操作由独立仓库负责。 */
export default function App() {
  // 场景、战斗与信息面板共用同一组实例，重新渲染不会重置单位。
  const [localWorld] = useState(createLocalWorld)
  const [game] = useState(() => createGameStore(localWorld))
  const { character, monster, battle, experience, obtainedItems, panel, panelTarget, openPanel, closePanel, startBattle } = useStore(game.store)
  const lastAction = battle.lastAction

  useEffect(() => connectBattleClock(game), [game])

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
            <p className="battle-controls__status" role="status">{battle.statusLabel}</p>
            <p className="battle-controls__hint">每秒行动 · 角色先手 · 自动优先释放重击</p>
          </div>
          <button type="button" onClick={startBattle} disabled={!battle.canStart}>
            {battle.buttonLabel}
          </button>
        </section>
        {lastAction && <p key={lastAction.id} className="battle-action">{lastAction.attackerName} · {lastAction.actionName} <strong>{lastAction.damage} 伤害</strong></p>}
        <nav className="unit-panel-controls" aria-label="基础信息查看">
          <button type="button" onClick={() => openPanel('character')} aria-pressed={panelTarget === 'character'} aria-controls="unit-info-panel">角色面板</button>
          <button type="button" onClick={() => openPanel('monster')} aria-pressed={panelTarget === 'monster'} aria-controls="unit-info-panel">怪物面板</button>
        </nav>
        {panel && <UnitInfoPanel info={panel} onClose={closePanel} />}
        <section className="world__units" aria-label="本地角色与怪物">
          <CombatantCard info={character} hit={battle.characterHit} />
          <CombatantCard info={monster} hit={battle.monsterHit} />
        </section>
        <section className="battle-rewards" aria-label="经验和战利品">
          <span>累计经验 <strong>{experience}</strong></span>
          <span>获得物品 <strong>{obtainedItems}</strong></span>
        </section>
        <section className="battle-log" aria-label="战斗日志">
          <h2>战斗记录</h2>
          <ol>
            {battle.logs.length === 0 && <li>点击开始战斗，挑战野狼。胜利奖励：20 经验、狼牙 × 1。</li>}
            {battle.logs.map((record) => (
              <li key={record.id} className={record.isResult ? 'battle-log__result' : ''}>
                <time>{record.timeSeconds}s</time>{record.text}
              </li>
            ))}
          </ol>
        </section>
        <p className="battle-note">本地单场战斗 · 暂不升级或自动续战 · 刷新页面重新开始</p>
      </div>
    </main>
  )
}
