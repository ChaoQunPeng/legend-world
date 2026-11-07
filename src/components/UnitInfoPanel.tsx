import type { UnitInfo } from '../game/panels/unitInfo'

interface UnitInfoPanelProps {
  info: UnitInfo
  onClose: () => void
}

/** 临时基础信息面板：只展示预先整理的字段，将关闭操作交还业务仓库。 */
export function UnitInfoPanel({ info, onClose }: UnitInfoPanelProps) {
  return (
    <section id="unit-info-panel" className="unit-info-panel" aria-labelledby="unit-info-title">
      <header className="unit-info-panel__header">
        <h2 id="unit-info-title">{info.category}基础信息 · {info.name}</h2>
        <button type="button" onClick={onClose} aria-label={`关闭${info.category}面板`}>关闭</button>
      </header>
      <dl className="unit-info-panel__fields">
        {info.fields.map((field) => (
          <div key={field.label}><dt>{field.label}</dt><dd>{field.value}</dd></div>
        ))}
      </dl>
    </section>
  )
}
