import { useState } from 'react'
import type { EquipmentSlot, ItemType } from '../core'
import type { InventoryView, ItemView } from '../game/panels/inventory'

interface InventoryPanelProps {
  inventory: InventoryView
  onEquip: (itemId: string) => void
}

interface EquipmentPanelProps {
  equipment: InventoryView['equipment']
  onUnequip: (slot: EquipmentSlot) => void
}

const filters: readonly { value: ItemType | 'all'; label: string }[] = [
  { value: 'all', label: '全部' }, { value: 'equipment', label: '装备' },
  { value: 'material', label: '材料' }, { value: 'consumable', label: '消耗品' },
]

/** 品质和属性说明在背包与装备栏保持一致，帮助比较待穿戴装备。 */
function ItemDetails({ item }: { item: ItemView }) {
  return (
    <div className="item-details">
      <strong className={`item-name item-name--${item.quality}`}>{item.name}</strong>
      <span className="item-details__meta">{item.qualityLabel} · {item.slotLabel ?? item.typeLabel}</span>
      {item.bonuses.length > 0 && <span className="item-details__bonuses">{item.bonuses.join(' · ')}</span>}
    </div>
  )
}

/** 人物的六个装备部位常驻展示，空部位明确提示，已穿戴装备可以直接卸下。 */
export function EquipmentPanel({ equipment, onUnequip }: EquipmentPanelProps) {
  return (
    <section className="equipment-panel" aria-labelledby="equipment-title">
      <header className="section-heading">
        <h2 id="equipment-title">人物装备</h2>
        <span>{equipment.filter(({ item }) => item !== null).length} / {equipment.length} 已穿戴</span>
      </header>
      <div className="equipment-grid">
        {equipment.map(({ slot, label, item }) => (
          <article key={slot} className={`equipment-slot${item ? ' equipment-slot--occupied' : ''}`}>
            <span className="equipment-slot__label">{label}</span>
            {item ? <>
              <ItemDetails item={item} />
              <button type="button" onClick={() => onUnequip(slot)} aria-label={`卸下${item.name}`}>卸下</button>
            </> : <p className="equipment-slot__empty">未穿戴</p>}
          </article>
        ))}
      </div>
      <p className="panel-hint">同部位装备自动替换，卸下后放回背包；属性即时生效。</p>
    </section>
  )
}

/** 背包按类别筛选，装备逐件操作，材料显示合计数量；战斗掉落随仓库快照自动更新。 */
export function InventoryPanel({ inventory, onEquip }: InventoryPanelProps) {
  const [filter, setFilter] = useState<ItemType | 'all'>('all')
  const items = inventory.items.filter((item) => filter === 'all' || item.type === filter)

  return (
    <section className="inventory-panel dashboard-panel" aria-labelledby="inventory-title">
      <header className="section-heading">
        <h2 id="inventory-title">背包</h2>
        <span>{inventory.itemCount} 件物品</span>
      </header>
      <nav className="inventory-filters" aria-label="背包物品分类">
        {filters.map(({ value, label }) => (
          <button key={value} type="button" aria-pressed={filter === value} onClick={() => setFilter(value)}>{label}</button>
        ))}
      </nav>
      <div className="inventory-list">
        {items.map((item) => (
          <article key={item.id} className={`inventory-item inventory-item--${item.quality}`}>
            <ItemDetails item={item} />
            {item.type === 'equipment'
              ? <button type="button" onClick={() => onEquip(item.id)} aria-label={`穿戴${item.name}`}>穿戴</button>
              : <span className="inventory-item__quantity">× {item.quantity}</span>}
          </article>
        ))}
        {items.length === 0 && <p className="inventory-empty">{filter === 'all' ? '背包暂无物品' : `暂无${filters.find(({ value }) => value === filter)?.label}`}，战斗掉落会自动收入背包。</p>}
      </div>
      <p className="panel-hint">装备可直接穿戴，材料按种类汇总数量。</p>
    </section>
  )
}
