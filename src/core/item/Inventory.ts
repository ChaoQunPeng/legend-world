import type { Item } from './Item'

/** 入包结果区分实际收下数量与待领取数量，满包不吞掉落。 */
export interface ReceiveItemResult {
  received: number
  pending: number
}

/** 固定三十格背包；装备一件一格，材料与药水按定义上限占格。 */
export class Inventory {
  readonly capacity = 30
  private readonly stacks: Item[] = []
  private readonly waiting: Item[] = []
  private sequence = 0

  /** 返回格子快照，外部通过业务方法改变数量。 */
  get items(): readonly Item[] { return [...this.stacks] }

  /** 满包剩余掉落仅在主动领取时再次尝试入包。 */
  get pendingItems(): readonly Item[] { return [...this.waiting] }

  /** 优先补已有堆叠，再开新格；装备直接保存原实例以保留身份。 */
  private put(item: Item): number {
    let remaining = item.quantity
    if (item.type !== 'equipment') {
      for (const [index, stack] of this.stacks.entries()) {
        if (stack.definitionId !== item.definitionId) continue
        const added = Math.min(remaining, stack.maxStack - stack.quantity)
        this.stacks[index] = stack.withQuantity(stack.quantity + added)
        remaining -= added
        if (remaining === 0) return 0
      }
    }
    while (remaining > 0 && this.stacks.length < this.capacity) {
      const quantity = Math.min(remaining, item.maxStack)
      this.stacks.push(item.type === 'equipment' ? item : item.withQuantity(quantity, `${item.id}-stack-${++this.sequence}`))
      remaining -= quantity
    }
    return remaining
  }

  /** 奖励入包不受经验结算影响；放不下的数量保存到待领取列表。 */
  receive(item: Item): ReceiveItemResult {
    const pending = this.put(item)
    if (pending > 0) this.waiting.push(item.type === 'equipment' ? item : item.withQuantity(pending, `${item.id}-pending-${++this.sequence}`))
    return { received: item.quantity - pending, pending }
  }

  /** 腾出空间后手动领取，支持部分领取，剩余数量仍保留。 */
  claim(itemId: string): ReceiveItemResult {
    const index = this.waiting.findIndex((item) => item.id === itemId)
    const item = this.waiting[index]
    // 页面可能在已领取后的旧快照上重复操作，此时不再发放。
    if (!item) return { received: 0, pending: 0 }
    const pending = this.put(item)
    if (pending === 0) this.waiting.splice(index, 1)
    else if (pending < item.quantity) this.waiting[index] = item.withQuantity(pending)
    return { received: item.quantity - pending, pending }
  }

  /** 丢弃或消耗当前格指定数量；输入数量必须是当前格内的正整数。 */
  remove(itemId: string, quantity: number): boolean {
    const index = this.stacks.findIndex((item) => item.id === itemId)
    const item = this.stacks[index]
    if (!item || !Number.isInteger(quantity) || quantity < 1 || quantity > item.quantity) return false
    if (quantity === item.quantity) this.stacks.splice(index, 1)
    else this.stacks[index] = item.withQuantity(item.quantity - quantity)
    return true
  }
}
