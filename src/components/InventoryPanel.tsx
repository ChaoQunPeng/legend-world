import { GameIcon } from './GameIcon'
import { useState } from 'react'
import type { EquipmentSlot, ItemType } from '../core'
import type { InventoryView, ItemView } from '../game/panels/inventory'

interface InventoryPanelProps {
  inventory: InventoryView
  onEquip: (itemId: string) => void
  onDiscard: (itemId: string, quantity: number) => void
  onUse: (itemId: string) => void
  onClaim: (itemId: string) => void
  message: string
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
      {item.requirementsLabel && <span className="item-details__meta">{item.requirementsLabel}</span>}
      {item.effectLabel && <span className="item-details__bonuses">{item.effectLabel} · 存活且未满血可用</span>}
      {item.bonuses.length > 0 && <span className="item-details__bonuses">基础：{item.bonuses.join(' · ')}</span>}
      {item.type === 'equipment' && <span className="item-details__bonuses">极品：{item.additionalBonuses.length > 0 ? item.additionalBonuses.join(' · ') : '无额外加成'}</span>}
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
      <p className="panel-hint">战斗中可换装，后续行动使用新属性。同部位自动替换，穿脱不恢复生命和魔法。</p>
    </section>
  )
}

/** 按核心格子展示堆叠、药水与待领取掉落，丢弃必须先确认数量。 */
export function InventoryPanel({ inventory, onEquip, onDiscard, onUse, onClaim, message }: InventoryPanelProps) {
  // 列表仅显示名称和数量，选中物品后在下方展示真实属性与业务操作。
  const [selectedId, setSelectedId] = useState<string | undefined>()
  const [filter, setFilter] = useState<ItemType | 'all'>('all')
  const [discardId, setDiscardId] = useState<string | undefined>()
  // 保留输入文本，支持清空后重新填写；提交时由表单约束整数范围。
  const [quantity, setQuantity] = useState('1')
  const discardItem = inventory.items.find((item) => item.id === discardId)
  const selectedItem = inventory.items.find((item) => item.id === selectedId)
  const items = inventory.items.filter((item) => filter === 'all' || item.type === filter)

  return (
    <section className="inventory-panel dashboard-panel" aria-labelledby="inventory-title">
      <header className="section-heading">
        <h2 id="inventory-title"><GameIcon name="backpack" />背包</h2>
        <span>{inventory.usedSlots} / {inventory.capacity} 格 · {inventory.itemCount} 件</span>
      </header>
      <details className="info-details"><summary>背包规则</summary><p className="panel-hint">装备每件 1 格 · 材料每格 99 个 · 药水每格 20 瓶。药水战斗中也可使用；腾出空间后需手动领取掉落。</p></details>
      <p className="inventory-message" role="status">{message}</p>
      {discardItem && <form className="discard-confirm" aria-label="确认丢弃物品" onSubmit={(event) => {
        event.preventDefault()
        onDiscard(discardItem.id, Number(quantity))
        setDiscardId(undefined)
      }}>
        <strong>丢弃「{discardItem.name}」</strong>
        <label>数量（最多 {discardItem.quantity}）<input aria-label="丢弃数量" type="number" min={1} max={discardItem.quantity} step={1} required value={quantity} onChange={(event) => setQuantity(event.currentTarget.value)} /></label>
        <p>确认后物品将被移除。</p>
        <div className="inventory-actions"><button type="submit">确认丢弃</button><button type="button" onClick={() => setDiscardId(undefined)}>取消</button></div>
      </form>}
      <nav className="inventory-filters" aria-label="背包物品分类">
        {filters.map(({ value, label }) => (
          <button key={value} type="button" aria-pressed={filter === value} onClick={() => setFilter(value)}>{label}</button>
        ))}
      </nav>
      <div className="inventory-list">
        {items.map((item) => (
          <button type="button" key={item.id} className="inventory-row" aria-pressed={selectedId === item.id} onClick={() => setSelectedId(item.id)}>
            <span className={`item-name item-name--${item.quality}`}>{item.name}</span>
            <span className="inventory-row__quantity">x{item.quantity}</span>
          </button>
        ))}
        {items.length === 0 && <p className="inventory-empty">{filter === 'all' ? '背包暂无物品' : `暂无${filters.find(({ value }) => value === filter)?.label}`}，战斗掉落会自动收入背包。</p>}
      </div>
      {selectedItem && <div className="selected-item">
        <ItemDetails item={selectedItem} />
        <div className="inventory-actions">
          {selectedItem.type === 'equipment' && <button type="button" disabled={!selectedItem.canEquip} title={selectedItem.equipFailure} onClick={() => onEquip(selectedItem.id)} aria-label={`穿戴${selectedItem.name}`}>{selectedItem.canEquip ? '穿戴' : selectedItem.equipFailure}</button>}
          {selectedItem.type === 'consumable' && <button type="button" disabled={!selectedItem.canUse} onClick={() => onUse(selectedItem.id)} aria-label={`使用${selectedItem.name}`}>使用</button>}
          <button type="button" onClick={() => { setDiscardId(selectedItem.id); setQuantity('1') }}>丢弃</button>
          <button type="button" className="quiet-button" onClick={() => setSelectedId(undefined)}>关闭</button>
        </div>
      </div>}
      
      <section className="pending-items" aria-labelledby="pending-items-title">
        <header className="section-heading"><h3 id="pending-items-title">待领取掉落</h3><span>{inventory.pendingItems.reduce((sum, item) => sum + item.quantity, 0)} 件</span></header>
        {inventory.pendingItems.length === 0 && <p className="panel-hint">暂无待领取掉落。</p>}
        <div className="inventory-list">{inventory.pendingItems.map((item) => <article className="inventory-item" key={item.id}>
          <ItemDetails item={item} />
          <div className="inventory-actions"><span className="inventory-item__quantity">× {item.quantity}</span><button type="button" aria-label={`领取${item.name}`} onClick={() => onClaim(item.id)}>领取</button></div>
        </article>)}</div>
      </section>
    </section>
  )
}
