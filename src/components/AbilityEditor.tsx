import { useEffect, useRef, useState } from 'react'
import type { ChangeEvent, FormEvent, MouseEvent } from 'react'
import type { EffectDefinition, SkillDefinition } from '../core'
import { abilityStatLabels, createAbilityDocument, effectTypeLabels, loadAbilityDocument, parseAbilityDocument, saveAbilityDocument } from '../game/data/abilityEditorStorage'
import type { EffectEntry } from '../game/data/abilityEditorStorage'
import { describeEffect } from '../game/panels/skillDescriptions'
import '../styles/monsterEditor.css'

/** 在浏览器授权的目标文件中写入配置；不支持文件选择器时下载 JSON。 */
async function writeAbilityFile(json: string) {
  const picker = (window as Window & { showSaveFilePicker?: (options: { suggestedName: string }) => Promise<{ createWritable: () => Promise<{ write: (content: string) => Promise<void>; close: () => Promise<void> }> }> }).showSaveFilePicker
  if (picker) {
    const handle = await picker.call(window, { suggestedName: 'skills-effects.json' })
    const writer = await handle.createWritable()
    await writer.write(json)
    await writer.close()
  } else {
    const url = URL.createObjectURL(new Blob([json], { type: 'application/json' }))
    const link = document.createElement('a')
    link.href = url
    link.download = 'skills-effects.json'
    link.click()
    setTimeout(() => URL.revokeObjectURL(url), 1000)
  }
}

/** 技能和效果各自独立页面，共用目录持久化及列表表单布局。 */
export function AbilityEditor({ mode }: { mode: 'skills' | 'effects' }) {
  const [initial] = useState(() => {
    try { return { document: loadAbilityDocument(), message: '目录保存在当前浏览器；关联保存配置快照，修改后需要重新关联。' } }
    catch (error) { return { document: createAbilityDocument(), message: `读取失败，已显示项目模板：${String(error)}` } }
  })
  const [document, setDocument] = useState(initial.document)
  const [saved, setSaved] = useState(initial.document)
  const [index, setIndex] = useState(0)
  const [search, setSearch] = useState('')
  const [effectId, setEffectId] = useState(initial.document.effects[0].id)
  const [message, setMessage] = useState(initial.message)
  const input = useRef<HTMLInputElement>(null)
  const entries = document[mode]
  const entry = entries[index]
  const skill = document.skills[index]
  const effect = document.effects[index]
  const title = mode === 'skills' ? '技能' : '效果'
  const dirty = JSON.stringify(document) !== JSON.stringify(saved)

  /** 页面关闭时保护未保存草稿。 */
  useEffect(() => {
    const warn = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = '' }
    if (dirty) window.addEventListener('beforeunload', warn)
    return () => window.removeEventListener('beforeunload', warn)
  }, [dirty])

  /** 所有编辑按目录索引更新，允许 ID 在输入过程中暂时为空。 */
  function updateEntry(patch: { id?: string; name?: string }) {
    if (mode === 'skills') updateSkill({ ...skill, ...patch })
    else updateEffect({ ...effect, ...patch })
  }
  /** 替换技能快照，保留其他技能与整个效果目录。 */
  function updateSkill(next: SkillDefinition) {
    setDocument((current) => ({ ...current, skills: current.skills.map((item, position) => position === index ? next : item) }))
  }
  /** 替换效果目录条目，不隐式改写已关联的技能效果快照。 */
  function updateEffect(next: EffectEntry) {
    setDocument((current) => ({ ...current, effects: current.effects.map((item, position) => position === index ? next : item) }))
  }
  /** 新建与复制使用唯一 ID，后续仍可在基本信息内编辑。 */
  function addEntry(copy: boolean) {
    const id = `${mode === 'skills' ? 'skill' : 'effect'}-${crypto.randomUUID()}`
    const name = copy ? `${entry.name}（副本）` : `新${title}`
    if (mode === 'skills') setDocument((current) => ({ ...current, skills: [...current.skills, copy ? { ...structuredClone(skill), id, name } : { id, name, type: 'active', manaCost: 0, cooldownMs: 0, effects: [] }] }))
    else setDocument((current) => ({ ...current, effects: [...current.effects, copy ? { ...structuredClone(effect), id, name } : { id, name, definition: { type: 'damage', target: 'target', amount: 0 } }] }))
    setIndex(entries.length)
    setSearch('')
  }
  /** 保存两个目录前统一校验，同时更新取消修改的恢复点。 */
  function save(event: FormEvent) {
    event.preventDefault()
    try { parseAbilityDocument(JSON.stringify(document)); saveAbilityDocument(document); setSaved(document); setMessage('技能与效果目录已保存到 localStorage。') }
    catch (error) { setMessage(`保存失败：${String(error)}`) }
  }
  /** 外部文件先校验，再由用户确认替换草稿。 */
  async function importFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    if (!file) return
    try {
      const next = parseAbilityDocument(await file.text())
      if (!window.confirm('将替换全部技能与效果草稿，是否继续？')) return
      setDocument(next); setIndex(0); setEffectId(next.effects[0].id); setSearch(''); setMessage('已导入草稿，请保存配置。')
    } catch (error) { setMessage(`导入失败：${String(error)}`) }
    finally { event.target.value = '' }
  }
  /** 导出当前完整草稿，取消文件选择不作为错误提示。 */
  async function exportFile() {
    try { await writeAbilityFile(JSON.stringify(parseAbilityDocument(JSON.stringify(document)), null, 2)); setMessage('技能与效果配置文件已导出。') }
    catch (error) { if (!(error instanceof DOMException && error.name === 'AbortError')) setMessage(`导出失败：${String(error)}`) }
  }
  /** 修改类型会重置该类型专属字段，避免保留不符合核心联合类型的配置。 */
  function changeEffectType(type: EffectDefinition['type']) {
    updateEffect({ ...effect, definition: type === 'physicalDamage' ? { type, target: 'target', attackBonus: 0, description: effect.definition.description } : { type, target: 'target', amount: 0, description: effect.definition.description } })
  }
  /** 主动技能效果按列表顺序执行，允许同一效果多次关联。 */
  function moveEffect(position: number, direction: number) {
    if (skill.type !== 'active') return
    const effects = [...skill.effects]
    ;[effects[position], effects[position + direction]] = [effects[position + direction], effects[position]]
    updateSkill({ ...skill, effects })
  }
  /** 返回游戏会离开当前页，需要保护草稿；其他配置入口在新标签页打开。 */
  function guardNavigation(event: MouseEvent<HTMLAnchorElement>) {
    if (dirty && !window.confirm('未保存修改将丢失，确定离开？')) event.preventDefault()
  }

  return <div className="monster-editor">
    <header className="monster-editor__header"><div><p>LEGEND WORLD / CONFIGURATION</p><h1>{title}配置编辑器</h1></div><div className="ability-editor__links"><a href="#/monster-editor" target="_blank" rel="noopener noreferrer">怪物配置</a><a href={mode === 'skills' ? '#/effect-editor' : '#/skill-editor'} target="_blank" rel="noopener noreferrer">{mode === 'skills' ? '效果配置' : '技能配置'}</a><a href="#" onClick={guardNavigation}>返回游戏 ↗</a></div></header>
    <div className="monster-editor__toolbar"><span>{entries.length} 个{title} · {dirty ? '有未保存修改' : '无未保存修改'}</span><div><button type="button" onClick={() => input.current!.click()}>导入 JSON</button><button type="button" onClick={exportFile}>导出 / 保存文件</button><input hidden ref={input} type="file" accept=".json,application/json" onChange={importFile} /></div></div>
    <div className="monster-editor__layout"><aside><div className="monster-editor__section-title"><h2>{title}列表</h2><button type="button" onClick={() => addEntry(false)}>＋ 新增</button></div><input aria-label={`搜索${title}`} placeholder="搜索名称 / ID" value={search} onChange={(event) => setSearch(event.target.value)} /><nav>{entries.map((item, position) => `${item.name} ${item.id}`.toLowerCase().includes(search.toLowerCase()) && <button type="button" key={position} aria-current={position === index ? 'true' : undefined} onClick={() => setIndex(position)}><strong>{item.name}</strong><small>{item.id}</small></button>)}</nav></aside>
    <form onSubmit={save}><div className="monster-editor__section-title"><h2>{entry.name}</h2><button type="button" onClick={() => addEntry(true)}>复制当前{title}</button></div>
      <section><h3>01 / 基本信息</h3><div className="monster-editor__fields"><label>{title} ID<input required value={entry.id} onChange={(event) => updateEntry({ id: event.target.value })} /></label><label>{title}名称<input required value={entry.name} onChange={(event) => updateEntry({ name: event.target.value })} /></label></div></section>
      {/* 玩家文案与战斗数值独立维护，效果说明保存在核心定义内，关联时一同复制。 */}
      <label className="ability-editor__description">{title}说明（给玩家看）<textarea rows={3} placeholder="填写玩家看到的介绍，例如：凝聚力量发动重击，对敌人造成物理伤害。" value={(mode === 'skills' ? skill.description : effect.definition.description) ?? ''} onChange={(event) => { if (mode === 'skills') updateSkill({ ...skill, description: event.target.value }); else updateEffect({ ...effect, definition: { ...effect.definition, description: event.target.value } }) }} /></label>
      {mode === 'effects' ? <section><h3>02 / 效果配置</h3><div className="monster-editor__fields"><label>效果类型<select value={effect.definition.type} onChange={(event) => changeEffectType(event.target.value as EffectDefinition['type'])}>{Object.entries(effectTypeLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label><label>作用目标<select disabled={effect.definition.type === 'physicalDamage'} value={effect.definition.target} onChange={(event) => { if (effect.definition.type !== 'physicalDamage') updateEffect({ ...effect, definition: { ...effect.definition, target: event.target.value as 'self' | 'target' } }) }}><option value="target">目标</option><option value="self">自身</option></select></label><label>{effect.definition.type === 'physicalDamage' ? '本次物攻加成' : '固定数值'}<input required type="number" min="0" step="any" value={effect.definition.type === 'physicalDamage' ? effect.definition.attackBonus : effect.definition.amount} onChange={(event) => updateEffect({ ...effect, definition: effect.definition.type === 'physicalDamage' ? { ...effect.definition, attackBonus: event.target.valueAsNumber } : { ...effect.definition, amount: event.target.valueAsNumber } })} /></label></div><p className="monster-editor__hint">{describeEffect(effect.definition)}</p></section>
      : <><section><h3>02 / 技能规则</h3><div className="monster-editor__fields"><label>技能类型<select value={skill.type} onChange={(event) => { if (!window.confirm('切换类型会重置耗魔、冷却、效果或被动属性，是否继续？')) return; updateSkill(event.target.value === 'active' ? { id: skill.id, name: skill.name, description: skill.description, type: 'active', manaCost: 0, cooldownMs: 0, effects: [] } : { id: skill.id, name: skill.name, description: skill.description, type: 'passive', stats: {} }) }}><option value="active">主动技能</option><option value="passive">被动技能</option></select></label>{skill.type === 'active' ? <><label>魔法消耗<input required type="number" min="0" step="any" value={skill.manaCost} onChange={(event) => updateSkill({ ...skill, manaCost: event.target.valueAsNumber })} /></label><label>冷却（毫秒）<input required type="number" min="0" step="1" value={skill.cooldownMs} onChange={(event) => updateSkill({ ...skill, cooldownMs: event.target.valueAsNumber })} /></label></> : Object.entries(abilityStatLabels).map(([key, label]) => <label key={key}>{label}<input required type="number" step="any" value={skill.stats[key as keyof typeof abilityStatLabels] ?? 0} onChange={(event) => updateSkill({ ...skill, stats: { ...skill.stats, [key]: event.target.valueAsNumber } })} /></label>)}</div></section>
      {skill.type === 'active' && <section><h3>03 / 效果执行顺序</h3><div className="monster-editor__skill-picker"><select aria-label="选择效果" value={effectId} onChange={(event) => setEffectId(event.target.value)}>{document.effects.map((item) => <option key={item.id} value={item.id}>{item.name} · {describeEffect(item.definition)}</option>)}</select><button type="button" onClick={() => updateSkill({ ...skill, effects: [...skill.effects, structuredClone(document.effects.find((item) => item.id === effectId)!.definition)] })}>＋ 关联效果</button></div><ol className="monster-editor__skills">{skill.effects.map((item, position) => <li key={position}><span className="monster-editor__order">{position + 1}</span><div>{describeEffect(item)}</div><div className="monster-editor__skill-actions"><button type="button" disabled={position === 0} onClick={() => moveEffect(position, -1)}>↑</button><button type="button" disabled={position === skill.effects.length - 1} onClick={() => moveEffect(position, 1)}>↓</button><button type="button" onClick={() => updateSkill({ ...skill, effects: skill.effects.filter((_, i) => i !== position) })}>移除</button></div></li>)}</ol>{skill.effects.length === 0 && <p className="monster-editor__empty">尚未关联效果。</p>}<p className="monster-editor__hint">按顺序执行效果；关联的是当前快照，效果目录修改后请移除并重新关联。</p></section>}</>}
      <footer><p role="status">{message}</p><div><button type="button" disabled={!dirty} onClick={() => { if (window.confirm('确定放弃全部未保存修改？')) { setDocument(saved); setIndex(0); setEffectId(saved.effects[0].id); setMessage('已恢复保存配置。') } }}>取消修改</button><button className="monster-editor__primary" type="submit">保存配置</button></div></footer>
    </form></div>
  </div>
}
