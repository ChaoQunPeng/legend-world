import { useState } from 'react'
import type { ItemDefinition } from '../core/item/Item'
import type { DropEntry } from '../core/item/drops'

const itemTypes = { equipment: '装备', consumable: '消耗品', material: '材料' }

interface MonsterDropEditorProps {
  drops: readonly DropEntry[]
  items: readonly ItemDefinition[]
  onChange: (drops: readonly DropEntry[]) => void
}

/** 掉落编辑直接使用核心掉落表：每条独立抽取，命中后生成一件物品。 */
export function MonsterDropEditor({ drops, items, onChange }: MonsterDropEditorProps) {
  const [itemId, setItemId] = useState(items[0].id)

  /** 只更新指定掉落条目，保留其他条目的物品定义和概率。 */
  function updateDrop(index: number, patch: Partial<DropEntry>) {
    onChange(drops.map((entry, position) => position === index ? { ...entry, ...patch } : entry))
  }

  /** 从现有物品目录关联一条独立掉落，默认概率为 100%，后续可调整。 */
  function addDrop() {
    onChange([...drops, { item: items.find((item) => item.id === itemId)!, probability: 1 }])
  }

  return (
    <section>
      <div className="monster-editor__section-title"><h3>04 / 掉落物品配置</h3><span>{drops.length} 条掉落</span></div>
      <div className="monster-editor__skill-picker">
        <select aria-label="选择掉落物品" value={itemId} onChange={(event) => setItemId(event.target.value)}>
          {items.map((item) => <option key={item.id} value={item.id}>{item.name} · {itemTypes[item.type]} · {item.id}</option>)}
        </select>
        <button type="button" onClick={addDrop}>＋ 添加掉落</button>
      </div>
      {drops.length === 0 && <p className="monster-editor__empty">尚未配置掉落，击杀后不掉落物品。</p>}
      <ol className="monster-editor__drops">
        {drops.map((entry, index) => (
          <li key={index}>
            <span className="monster-editor__order">{String(index + 1).padStart(2, '0')}</span>
            <div className="monster-editor__drop-item"><strong>{entry.item.name}</strong><small>{entry.item.id} · {itemTypes[entry.item.type]} · 每次 1 件</small></div>
            <label>掉落概率（%）<input aria-label={`${entry.item.name}第${index + 1}条掉落概率（%）`} required type="number" min="0" max="100" step="any" value={Number((entry.probability * 100).toFixed(8))} onChange={(event) => updateDrop(index, { probability: event.target.valueAsNumber / 100 })} /></label>
            <button type="button" aria-label={`移除第${index + 1}条${entry.item.name}掉落`} onClick={() => onChange(drops.filter((_, position) => position !== index))}>移除</button>
          </li>
        ))}
      </ol>
      <p className="monster-editor__hint">各条掉落独立判定，概率无需合计为 100%；0% 不掉落，100% 必掉。同一物品可配置多条，每条命中各掉落 1 件。装备品质与极品属性由战斗掉落规则独立生成。</p>
    </section>
  )
}
