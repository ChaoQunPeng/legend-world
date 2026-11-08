import { useEffect, useState } from 'react'
import { useStore } from 'zustand'
import { CombatantCard } from '../components/CombatantCard'
import { UnitInfoPanel } from '../components/UnitInfoPanel'
import { CharacterGrowthPanel } from '../components/CharacterGrowthPanel'
import { SkillPanel } from '../components/SkillPanel'
import { EquipmentPanel, InventoryPanel } from '../components/InventoryPanel'
import { createLocalWorld } from '../game/data/localWorld'
import { connectBattleClock, createGameStore } from '../stores/gameStore'

/** 游戏工作台同时展示角色、装备、背包和战斗，所有操作共用同一组核心实例。 */
export default function App() {
  // 页面重新渲染只读取快照，不重建人物、背包或挂机协调器。
  const [localWorld] = useState(createLocalWorld)
  const [game] = useState(() => createGameStore(localWorld, () => performance.now(), Math.random))
  const { character, monster, battle, experience, growth, obtainedItems, inventory, equipItem, unequipItem, discardItem, useItem, claimItem, inventoryMessage, startBattle, stopBattle, revive, skillBook, skillMessage, learnSkill } = useStore(game.store)
  const lastAction = battle.lastAction

  useEffect(() => connectBattleClock(game), [game])

  return (
    <main className="world">
      <header className="world__header">
        <div>
          <p className="world__eyebrow" lang="en">LEGEND WORLD</p>
          <h1>传奇世界</h1>
        </div>
        <div><p className="world__message">山海之间，传奇初启。</p><a href="#/monster-editor">怪物配置编辑器 ↗</a></div>
      </header>
      <div className="world__dashboard">
        <section className="character-panel dashboard-panel" aria-label="角色与装备">
          <CombatantCard info={character} hit={battle.characterHit} />
          <CharacterGrowthPanel growth={growth} />
          <SkillPanel book={skillBook} message={skillMessage} onLearn={learnSkill} />
          <EquipmentPanel equipment={inventory.equipment} onUnequip={unequipItem} />
          <UnitInfoPanel info={character} />
        </section>
        <InventoryPanel inventory={inventory} onEquip={equipItem} onDiscard={discardItem} onUse={useItem} onClaim={claimItem} message={inventoryMessage} />
        <div className="world__battle-panel dashboard-panel">
          <section className="battle-controls" aria-label="战斗控制">
            <div>
              <p className="battle-controls__status" role="status">{battle.statusLabel}</p>
              <p className="battle-controls__hint">每秒行动 · 角色先手 · 自动优先释放重击</p>
            </div>
            <div className="battle-controls__actions">
              <button type="button" onClick={startBattle} disabled={!battle.canStart}>{battle.buttonLabel}</button>
              <button type="button" onClick={stopBattle} disabled={!battle.canStop}>{battle.stopRequested && battle.isActive ? '本场后停止' : '停止挂机'}</button>
              {battle.canRevive && <button type="button" onClick={revive}>复活（回满生命 / 魔法）</button>}
            </div>
          </section>
          <p className="panel-hint">第 {battle.battleNumber} 场 · 已击杀 {battle.kills} 只
            {(battle.phase === 'waiting' || (battle.phase === 'stopped' && battle.status === 'victory')) && ` · 刷新剩余 ${battle.waitRemainingSeconds} 秒`}
          </p>
          {lastAction && <p key={lastAction.id} className="battle-action">{lastAction.attackerName} · {lastAction.actionName} <strong>{lastAction.hit ? `${lastAction.damage} 伤害` : '未命中'}</strong></p>}
          <CombatantCard info={monster} hit={battle.monsterHit} />
          <UnitInfoPanel info={monster} />
          <p className="panel-hint">普攻与物理伤害技能按攻击方命中率判定；未命中不造成伤害，技能仍消耗魔法并进入冷却。当前双方命中率为 100%，暂不计算闪避。</p>
          <section className="battle-rewards" aria-label="经验和战利品">
            <span>累计经验 <strong>{experience}</strong></span>
            <span>最近一场掉落 <strong>{obtainedItems}</strong></span>
          </section>
          <p className="panel-hint">装备品质独立抽取：普通 70% · 优秀 20% · 稀有 8% · 史诗 2%，品质仅作标识。极品独立判定：20% 获得一项物攻或物防 +1～3，两种属性等概率、数值均匀。随机结果在掉落时固定；初始赠送装备保留预设品质与属性。</p>
          <section className="battle-log" aria-label="战斗日志">
            <h2>战斗记录</h2>
            <ol>
              {battle.logs.length === 0 && <li>点击开始挂机，持续挑战野狼。胜利获得 20 经验；各条掉落独立判定，可能不掉装备。</li>}
              {battle.logs.map((record) => (
                <li key={record.id} className={record.isResult ? 'battle-log__result' : ''}>
                  <time>{record.timeSeconds}s</time>{record.text}
                </li>
              ))}
            </ol>
          </section>
          <p className="battle-note">胜利后等待 2 秒刷新野狼，不额外恢复生命 / 魔法（升级仍回满）。停止挂机会打完当前场；等待时立即停止并保留倒计时。死亡无额外惩罚，复活后需手动开始。刷新页面重置角色与背包。</p>
        </div>
      </div>
    </main>
  )
}
