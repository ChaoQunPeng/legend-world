import { GameIcon } from './GameIcon'
import type { SkillBookView } from '../game/panels/skills'

interface SkillPanelProps {
  book: SkillBookView
  message: string
  onLearn: (skillId: string) => void
}

/** 技能面板展示真实目录与已学状态，学习权限由核心快照决定。 */
export function SkillPanel({ book, message, onLearn }: SkillPanelProps) {
  return (
    <section className="skill-panel" aria-labelledby="skill-title">
      <header className="section-heading">
        <h2 id="skill-title"><GameIcon name="zap" />职业技能</h2>
        <span>{book.learnedCount} / {book.entries.length} 已学习</span>
      </header>
      <details className="info-details"><summary>技能学习与释放规则</summary><p className="panel-hint">技能学习后默认为 1 级。主动技能按优先级释放，冷却或魔法不足时尝试后续技能，均不可用时普攻；被动技能学会后持续生效。</p></details>
      <p className="skill-message" role="status">{message}</p>
      <ol className="skill-list">
        {book.entries.map((skill) => (
          <li key={skill.id} className={`skill-entry${skill.learned ? ' skill-entry--learned' : ''}`}>
            <div className="skill-entry__content"><div className="skill-entry__heading"><h3>{skill.name}{skill.learned ? ` · Lv.${skill.level}` : ''}</h3><span>{skill.type === 'passive' ? '被动' : `主动 · 优先级 ${skill.priority}`}</span></div>
            <p className="skill-entry__meta">{skill.profession} · 需要 Lv.{skill.requiredLevel}{skill.type === 'active' ? ` · 耗魔 ${skill.manaCost} · 冷却 ${skill.cooldownSeconds} 秒` : ' · 不占用行动'}</p>
            <p className="skill-entry__effects">{skill.effects.join('；')}</p>
            {skill.type === 'passive' && <p className="skill-entry__meta">学习只增加生命上限，不恢复当前生命。</p>}
            </div><button type="button" disabled={!skill.canLearn} onClick={() => onLearn(skill.id)} aria-label={`学习${skill.name}`}>
              {skill.canLearn ? '学习' : skill.unavailableReason}
            </button>
          </li>
        ))}
      </ol>
    </section>
  )
}
