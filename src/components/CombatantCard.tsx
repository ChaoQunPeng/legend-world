import type { UnitInfo } from '../game/panels/unitInfo'
import type { DamageRecord } from '../core'

interface CombatantCardProps {
  info: UnitInfo
  hit?: DamageRecord
}

/** 展示仓库提供的当前状态和基础属性快照，角色与怪物共用相同的展示口径。 */
export function CombatantCard({ info, hit }: CombatantCardProps) {
  const { category, detail, stats } = info

  return (
    <article className="combatant-card" aria-label={`${category}：${info.name}`}>
      <header className="combatant-card__header">
        <div>
          <p className="combatant-card__category">{category}</p>
          <h2>{info.name}</h2>
        </div>
        <span className="combatant-card__detail">{detail}</span>
      </header>
      <div className="combatant-card__vitals">
        <div className="combatant-card__health-label">
          <span>{info.isAlive ? '生命' : '已倒下'}</span>
          <strong>{info.health} / {stats.maxHealth}</strong>
        </div>
        <progress className="combatant-card__health" aria-label={`${info.name}生命`} value={info.health} max={stats.maxHealth} />
        <div className="combatant-card__mana">魔法 {info.mana} / {stats.maxMana}</div>
        {hit && <span key={hit.id} className="combatant-card__damage">−{hit.damage}</span>}
      </div>
      <dl className="combatant-card__stats">
        <div><dt>物理攻击</dt><dd>{stats.attack}</dd></div>
        <div><dt>物理防御</dt><dd>{stats.defense}</dd></div>
        <div><dt>魔法攻击</dt><dd>{stats.magicAttack}</dd></div>
        <div><dt>魔法防御</dt><dd>{stats.magicDefense}</dd></div>
      </dl>
    </article>
  )
}
