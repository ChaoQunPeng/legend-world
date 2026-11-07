import { useEffect, useState } from 'react'
import { useStore } from 'zustand'
import { CombatantCard } from '../components/CombatantCard'
import { UnitInfoPanel } from '../components/UnitInfoPanel'
import { EquipmentPanel, InventoryPanel } from '../components/InventoryPanel'
import { createLocalWorld } from '../game/data/localWorld'
import { connectBattleClock, createGameStore } from '../stores/gameStore'

/** 游戏工作台同时展示角色、装备、背包和战斗，所有操作共用同一组核心实例。 */
export default function App() {
  // 页面重新渲染只读取快照，不重建人物、背包或单场战斗。
  const [localWorld] = useState(createLocalWorld)
  const [game] = useState(() => createGameStore(localWorld))
  const { character, monster, battle, experience, obtainedItems, inventory, equipItem, unequipItem, startBattle } = useStore(game.store)
  const lastAction = battle.lastAction

  useEffect(() => connectBattleClock(game), [game])

  return (
    <main className="world">
      <header className="world__header">
        <div>
          <p className="world__eyebrow" lang="en">LEGEND WORLD</p>
          <h1>传奇世界</h1>
        </div>
        <p className="world__message">山海之间，传奇初启。</p>
      </header>
      <div className="world__dashboard">
        <section className="character-panel dashboard-panel" aria-label="角色与装备">
          <CombatantCard info={character} hit={battle.characterHit} />
          <EquipmentPanel equipment={inventory.equipment} onUnequip={unequipItem} />
          <UnitInfoPanel info={character} />
        </section>
        <InventoryPanel inventory={inventory} onEquip={equipItem} />
        <div className="world__battle-panel dashboard-panel">
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
          <CombatantCard info={monster} hit={battle.monsterHit} />
          <UnitInfoPanel info={monster} />
          <section className="battle-rewards" aria-label="经验和战利品">
            <span>累计经验 <strong>{experience}</strong></span>
            <span>战斗掉落 <strong>{obtainedItems}</strong></span>
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
          <p className="battle-note">本地单场战斗 · 暂不升级或自动续战 · 刷新页面重置角色与背包</p>
        </div>
      </div>
    </main>
  )
}
