import { useEffect, useRef, useState } from 'react'
import { useStore } from 'zustand'
import { GameIcon } from '../components/GameIcon'
import { CombatantCard } from '../components/CombatantCard'
import { UnitInfoPanel } from '../components/UnitInfoPanel'
import { CharacterGrowthPanel } from '../components/CharacterGrowthPanel'
import { SkillPanel } from '../components/SkillPanel'
import { EquipmentPanel, InventoryPanel } from '../components/InventoryPanel'
import { createLocalWorld } from '../game/data/localWorld'
import { connectBattleClock, createGameStore } from '../stores/gameStore'

const navigation = [
  { id: 'explore', label: '战场', icon: 'compass' },
  { id: 'character', label: '角色', icon: 'user' },
  { id: 'inventory', label: '背包', icon: 'backpack' },
  { id: 'skills', label: '技能', icon: 'zap' },
  { id: 'logs', label: '日志', icon: 'message' }
] as const

/** 暗黑文字工作台只负责布局与展示，挂机和物品操作继续调用现有仓库。 */
export default function App() {
  // 页面重新渲染只读取快照，不重建人物、背包或挂机协调器。
  const [localWorld] = useState(createLocalWorld)
  const [game] = useState(() => createGameStore(localWorld, () => performance.now(), Math.random))
  const {
    character,
    monster,
    battle,
    experience,
    growth,
    obtainedItems,
    inventory,
    equipItem,
    unequipItem,
    discardItem,
    useItem,
    claimItem,
    inventoryMessage,
    startBattle,
    stopBattle,
    revive,
    skillBook,
    skillMessage,
    learnSkill
  } = useStore(game.store)
  const lastAction = battle.lastAction
  const [activeTab, setActiveTab] = useState('explore')
  const [characterTab, setCharacterTab] = useState('stats')
  const [logExpanded, setLogExpanded] = useState(false)
  const logRef = useRef<HTMLOListElement>(null)

  // 新行动写入后滚动到最新记录；仅影响日志视口，不改变战斗状态。
  useEffect(() => {
    if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight
  }, [battle.logs, logExpanded, activeTab])

  useEffect(() => connectBattleClock(game), [game])

  return (
    <main className="world">
      <header className="world__header">
        <div className="world__identity">
          <span>{character.name}</span>
          <small>{character.detail}</small>
        </div>
        <div className="header-vitals">
          <label className="header-vital header-vital--health">
            <span>
              生命{' '}
              <b>
                {character.health}/{character.stats.maxHealth}
              </b>
            </span>
            <progress value={character.health} max={character.stats.maxHealth} />
          </label>
          <label className="header-vital header-vital--mana">
            <span>
              魔法{' '}
              <b>
                {character.mana}/{character.stats.maxMana}
              </b>
            </span>
            <progress value={character.mana} max={character.stats.maxMana} />
          </label>
          <label className="header-vital header-vital--experience">
            <span>
              经验 <b>{growth.requiredExperience === undefined ? '满级' : `${growth.experience}/${growth.requiredExperience}`}</b>
            </span>
            <progress value={growth.requiredExperience === undefined ? 1 : growth.experience} max={growth.requiredExperience ?? 1} />
          </label>
        </div>
        <a className="editor-link" href="#/monster-editor">
          配置 ↗
        </a>
      </header>
      <div className="world__dashboard" data-active-tab={activeTab}>
        <aside className="world__character dashboard-panel" aria-label="角色与装备">
          <div className="panel-tabs" aria-label="角色信息分类">
            <button type="button" aria-pressed={characterTab === 'stats'} onClick={() => setCharacterTab('stats')}>
              角色属性
            </button>
            <button type="button" aria-pressed={characterTab === 'equipment'} onClick={() => setCharacterTab('equipment')}>
              装备槽位
            </button>
          </div>
          <div hidden={characterTab !== 'stats'}>
            <CombatantCard info={character} hit={battle.characterHit} />
            <CharacterGrowthPanel growth={growth} />
            <details className="info-details">
              <summary>角色详细信息</summary>
              <UnitInfoPanel info={character} />
            </details>
          </div>
          <div hidden={characterTab !== 'equipment'}>
            <EquipmentPanel equipment={inventory.equipment} onUnequip={unequipItem} />
          </div>
        </aside>
        <div className="world__battle-panel">
          <section className="battlefield dashboard-panel" aria-label="文字战场">
            <header className="section-heading">
              <h2>
                <GameIcon name="compass" />地图: <strong>野外战场</strong>
              </h2>
              <span>
                第 {battle.battleNumber} 场 · 击杀 {battle.kills}
              </span>
            </header>
            {/* 网格仅呈现当前交战双方，不提供尚未实现的地图移动或采集操作。 */}
            <div className="battlefield__grid">
              {Array.from({ length: 36 }, (_, index) => (
                <div
                  key={index}
                  className={`battlefield__cell${index === 14 ? ' battlefield__cell--player' : index === 16 ? ' battlefield__cell--monster' : ''}`}
                >
                  {index === 14 ? (
                    <>
                      <strong>我</strong>
                      <progress aria-label="战场角色生命" value={character.health} max={character.stats.maxHealth} />
                    </>
                  ) : index === 16 ? (
                    <>
                      <strong>{monster.name}</strong>
                      <progress aria-label="战场怪物生命" value={monster.health} max={monster.stats.maxHealth} />
                    </>
                  ) : (
                    <span>空</span>
                  )}
                </div>
              ))}
            </div>
          </section>
          <div className="battle-target dashboard-panel">
            <div className="target-heading">
              <strong>{monster.name}</strong>
              <span>{monster.detail}</span>
            </div>
            <div className="target-health">
              <span>状态</span>
              <span>
                {monster.health} / {monster.stats.maxHealth}
              </span>
            </div>
            <div className="target-health__blocks" aria-label="目标生命">
              {'█'.repeat(Math.round((monster.health / monster.stats.maxHealth) * 12))}
              <span>{'░'.repeat(12 - Math.round((monster.health / monster.stats.maxHealth) * 12))}</span>
            </div>
            <section className="battle-controls" aria-label="战斗控制">
              <div>
                <p className="battle-controls__status" role="status">
                  {battle.statusLabel}
                </p>
                <p className="battle-controls__hint">每秒行动 · 角色先手 · 自动优先释放重击</p>
              </div>
              <div className="battle-controls__actions">
                <button type="button" onClick={startBattle} disabled={!battle.canStart}>
                  {battle.buttonLabel}
                </button>
                <button type="button" onClick={stopBattle} disabled={!battle.canStop}>
                  {battle.stopRequested && battle.isActive ? '本场后停止' : '停止挂机'}
                </button>
                {battle.canRevive && (
                  <button type="button" onClick={revive}>
                    复活（回满生命 / 魔法）
                  </button>
                )}
              </div>
            </section>
            <p className="panel-hint">
              第 {battle.battleNumber} 场 · 已击杀 {battle.kills} 只
              {(battle.phase === 'waiting' || (battle.phase === 'stopped' && battle.status === 'victory')) &&
                ` · 刷新剩余 ${battle.waitRemainingSeconds} 秒`}
            </p>
            {lastAction && (
              <p key={lastAction.id} className="battle-action">
                {lastAction.attackerName} · {lastAction.actionName}{' '}
                <strong>{lastAction.hit ? `${lastAction.damage} 伤害` : '未命中'}</strong>
              </p>
            )}
            <details className="info-details">
              <summary>怪物属性与掉落详情</summary>
              <UnitInfoPanel info={monster} />
            </details>
            <details className="info-details">
              <summary>战斗规则</summary>
              <p className="panel-hint">
                普攻与物理伤害技能按攻击方命中率判定；未命中不造成伤害，技能仍消耗魔法并进入冷却。当前双方命中率为 100%，暂不计算闪避。
              </p>
            </details>
            <section className="battle-rewards" aria-label="经验和战利品">
              <span>
                累计经验 <strong>{experience}</strong>
              </span>
              <span>
                最近一场掉落 <strong>{obtainedItems}</strong>
              </span>
            </section>
            <details className="info-details">
              <summary>掉落规则</summary>
              <p className="panel-hint">
                装备品质独立抽取：普通 70% · 优秀 20% · 稀有 8% · 史诗 2%，品质仅作标识。极品独立判定：20% 获得一项物攻或物防
                +1～3，两种属性等概率、数值均匀。随机结果在掉落时固定；初始赠送装备保留预设品质与属性。
              </p>
            </details>
          </div>
          <section className="battle-log dashboard-panel" aria-label="战斗日志">
            <header className="section-heading">
              <h2>
                <GameIcon name="message" />
                游戏日志
              </h2>
              <button
                type="button"
                aria-expanded={logExpanded || activeTab === 'logs'}
                onClick={() => {
                  setLogExpanded(!(logExpanded || activeTab === 'logs'))
                  if (activeTab === 'logs') setActiveTab('explore')
                }}
              >
                {logExpanded || activeTab === 'logs' ? '收起历史' : `全部 (${battle.logs.length})`}
              </button>
            </header>
            <ol ref={logRef} className={logExpanded || activeTab === 'logs' ? 'battle-log__expanded' : ''}>
              {battle.logs.length === 0 && <li>点击开始挂机，持续挑战野狼。胜利获得 20 经验；各条掉落独立判定，可能不掉装备。</li>}
              {(logExpanded || activeTab === 'logs' ? battle.logs : battle.logs.slice(-3)).map(record => (
                <li key={record.id} className={record.isResult ? 'battle-log__result' : ''}>
                  <time>{record.timeSeconds}s</time>
                  {record.text}
                </li>
              ))}
            </ol>
          </section>
          <details className="info-details">
            <summary>挂机说明</summary>
            <p className="battle-note">
              胜利后等待 2 秒刷新野狼，不额外恢复生命 /
              魔法（升级仍回满）。停止挂机会打完当前场；等待时立即停止并保留倒计时。死亡无额外惩罚，复活后需手动开始。刷新页面重置角色与背包。
            </p>
          </details>
        </div>
        <aside className="world__sidebar">
          <div className="world__inventory">
            <InventoryPanel
              inventory={inventory}
              onEquip={equipItem}
              onDiscard={discardItem}
              onUse={useItem}
              onClaim={claimItem}
              message={inventoryMessage}
            />
          </div>
          <div className="world__skills dashboard-panel">
            <SkillPanel book={skillBook} message={skillMessage} onLearn={learnSkill} />
          </div>
          <section className="entity-radar dashboard-panel">
            <header className="section-heading">
              <h2>
                <GameIcon name="target" />
                附近实体列表 (1)
              </h2>
            </header>
            <div className="entity-radar__row">
              <span>
                {monster.name} {monster.detail}
              </span>
              <small>{monster.isAlive ? '当前目标' : '已击败'}</small>
            </div>
          </section>
        </aside>
      </div>
      <nav className="game-navigation" aria-label="游戏导航">
        {navigation.map(item => (
          <button
            key={item.id}
            type="button"
            aria-current={activeTab === item.id ? 'page' : undefined}
            onClick={() => setActiveTab(item.id)}
          >
            <GameIcon name={item.icon} />
            {item.label}
          </button>
        ))}
      </nav>
    </main>
  )
}
