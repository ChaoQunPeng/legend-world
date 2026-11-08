import type { EffectDefinition } from '../../core'

/** 玩家与怪物共用效果说明，从真实配置读取数值，不在面板另存伤害规则。 */
export function describeEffect(effect: EffectDefinition): string {
  // 旧存档和未填写文案的效果继续展示真实数值规则。
  if (effect.description?.trim()) return effect.description
  const target = effect.target === 'self' ? '自身' : '目标'
  switch (effect.type) {
    case 'physicalDamage': return `本次物攻 +${effect.attackBonus}，再扣除目标物防`
    case 'damage': return `对${target}造成 ${effect.amount} 点固定伤害`
    case 'heal': return `恢复${target} ${effect.amount} 点生命`
    case 'restoreMana': return `恢复${target} ${effect.amount} 点魔法`
  }
}
