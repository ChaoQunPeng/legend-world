import type { UnitInfo } from '../game/panels/unitInfo'

interface UnitInfoPanelProps {
  info: UnitInfo
}

/** 常驻基础信息面板：角色和怪物同时展示，各自使用独立的标题标识。 */
export function UnitInfoPanel({ info }: UnitInfoPanelProps) {
  return (
    <section className="unit-info-panel" aria-labelledby={`unit-info-title-${info.id}`}>
      <header className="unit-info-panel__header">
        <h2 id={`unit-info-title-${info.id}`}>{info.category}基础信息 · {info.name}</h2>
      </header>
      <dl className="unit-info-panel__fields">
        {info.fields.map((field) => (
          <div key={field.label}><dt>{field.label}</dt><dd>{field.value}</dd></div>
        ))}
      </dl>
    </section>
  )
}
