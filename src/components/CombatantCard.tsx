import type { Combatant } from '../core'
import type { DamageRecord } from '../core'

interface CombatantCardProps {
  combatant: Combatant
  category: string
  detail: string
  hit?: DamageRecord
}

/** 展示模型中的当前状态和基础属性，角色与怪物共用相同的展示口径。 */
export function CombatantCard({ combatant, category, detail, hit }: CombatantCardProps) {
  const stats = combatant.stats

  return (
    <article className="combatant-card" aria-label={`${category}：${combatant.name}`}>
      <header className="combatant-card__header">
        <div>
          <p className="combatant-card__category">{category}</p>
          <h2>{combatant.name}</h2>
        </div>
        <span className="combatant-card__detail">{detail}</span>
      </header>
      <div className="combatant-card__vitals">
        <div className="combatant-card__health-label">
          <span>{combatant.isAlive ? '生命' : '已倒下'}</span>
          <strong>{combatant.health} / {stats.maxHealth}</strong>
        </div>
        <progress className="combatant-card__health" aria-label={`${combatant.name}生命`} value={combatant.health} max={stats.maxHealth} />
        <div className="combatant-card__mana">魔法 {combatant.mana} / {stats.maxMana}</div>
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
