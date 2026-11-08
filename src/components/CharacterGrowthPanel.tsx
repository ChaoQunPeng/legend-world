import type { CharacterGrowthView } from '../game/panels/unitInfo'

/** 展示真实升级进度与下级成长，战斗奖励结算后随仓库快照同步更新。 */
export function CharacterGrowthPanel({ growth }: { growth: CharacterGrowthView }) {
  const isMaxLevel = growth.requiredExperience === undefined
  return (
    <section className="growth-panel" aria-labelledby="growth-title">
      <header className="section-heading">
        <h2 id="growth-title">角色成长</h2>
        <span>Lv.{growth.level} / {growth.maxLevel}</span>
      </header>
      <div className="growth-panel__progress-label" aria-live="polite">
        <span>{isMaxLevel ? '已达等级上限' : '升级进度'}</span>
        <strong>{isMaxLevel ? '满级' : `${growth.experience} / ${growth.requiredExperience}`}</strong>
      </div>
      <progress aria-label="升级经验" value={isMaxLevel ? 1 : growth.experience} max={growth.requiredExperience ?? 1} />
      {!isMaxLevel && (
        <>
          <p className="panel-hint">升至 Lv.{growth.level + 1} 获得</p>
          <ul className="growth-panel__increases">
            {growth.increases.map((field) => <li key={field.label}>{field.label}<strong>+{field.value}</strong></li>)}
          </ul>
        </>
      )}
      <p className="panel-hint">升级回满生命和魔法 · 装备加成另行计算</p>
    </section>
  )
}
