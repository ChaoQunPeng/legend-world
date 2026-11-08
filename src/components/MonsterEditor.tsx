import { useEffect, useRef, useState } from 'react'
import type { ChangeEvent, FormEvent } from 'react'
import type { MonsterDefinition } from '../core'
import type { CombatStats } from '../core/combat/Combatant'
import { localSkills } from '../game/data/localSkills'
import { createMonsterDocument, loadMonsterDocument, parseMonsterDocument, saveMonsterDocument } from '../game/data/monsterEditorStorage'
import '../styles/monsterEditor.css'

const ranks = { normal: '普通怪物', elite: '精英怪物', boss: '首领' }
const statFields: { key: keyof CombatStats; label: string; min: number; max?: number; step: number }[] = [
  { key: 'maxHealth', label: '生命上限', min: 1, step: 1 },
  { key: 'maxMana', label: '魔法上限', min: 0, step: 1 },
  { key: 'attack', label: '物理攻击', min: 0, step: 1 },
  { key: 'defense', label: '物理防御', min: 0, step: 1 },
  { key: 'magicAttack', label: '魔法攻击', min: 0, step: 1 },
  { key: 'magicDefense', label: '魔法防御', min: 0, step: 1 },
  { key: 'hitRate', label: '命中率（0～1）', min: 0, max: 1, step: 0.01 },
]
const skills = Object.values(localSkills)

/** 浏览器文件选择器的最小契约；不支持此能力的浏览器使用 JSON 下载。 */
interface FileWriter {
  write: (content: string) => Promise<void>
  close: () => Promise<void>
}
interface SaveFileWindow {
  showSaveFilePicker?: (options: { suggestedName: string; types: { description: string; accept: Record<string, string[]> }[] }) => Promise<{ createWritable: () => Promise<FileWriter> }>
}

/** 独立的怪物配置工作台，编辑草稿与已保存快照分开维护。 */
export function MonsterEditor() {
  const [initial] = useState(() => {
    try { return { document: loadMonsterDocument(), message: '配置保存在当前浏览器中，建议导出文件备份。' } }
    catch (error) { return { document: createMonsterDocument(), message: `读取本地配置失败，已显示项目模板：${String(error)}` } }
  })
  const [document, setDocument] = useState(initial.document)
  const [saved, setSaved] = useState(initial.document)
  const [selectedId, setSelectedId] = useState(initial.document.monsters[0].id)
  const [search, setSearch] = useState('')
  const [skillId, setSkillId] = useState<string>(skills[0].id)
  const [message, setMessage] = useState(initial.message)
  const importInput = useRef<HTMLInputElement>(null)
  const monster = document.monsters.find((item) => item.id === selectedId)!
  const dirty = JSON.stringify(document) !== JSON.stringify(saved)

  /** 刷新或关闭页面前提醒用户处理尚未保存的草稿。 */
  useEffect(() => {
    const warn = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = '' }
    if (dirty) window.addEventListener('beforeunload', warn)
    return () => window.removeEventListener('beforeunload', warn)
  }, [dirty])

  /** 修改当前怪物时保留其他怪物及未参与表单编辑的奖励数据。 */
  function updateMonster(patch: Partial<MonsterDefinition>) {
    // ID 是列表选择和持久化的唯一标识，编辑时禁止与其他怪物重复。
    if (patch.id !== undefined && document.monsters.some((item) => item.id !== selectedId && item.id === patch.id)) {
      setMessage('怪物 ID 已存在，请使用不同的 ID。')
      return
    }
    setDocument((current) => ({ ...current, monsters: current.monsters.map((item) => item.id === selectedId ? { ...item, ...patch } : item) }))
    if (patch.id !== undefined) setSelectedId(patch.id)
  }

  /** 新增或复制都生成独立 ID，并立即定位到新配置。 */
  function addMonster(copy: boolean) {
    const id = `monster-${crypto.randomUUID()}`
    const template = copy ? structuredClone(monster) : createMonsterDocument().monsters[0]
    const next: MonsterDefinition = { ...template, id, name: copy ? `${monster.name}（副本）` : '新怪物', ...(copy ? {} : { skills: [], rewards: { experience: 0, drops: [] } }) }
    setDocument((current) => ({ ...current, monsters: [...current.monsters, next] }))
    setSelectedId(id)
    setSearch('')
  }

  /** 使用原生表单约束和文档校验后，将全部怪物一次保存。 */
  function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    try {
      parseMonsterDocument(JSON.stringify(document))
      saveMonsterDocument(document)
      setSaved(document)
      setMessage('全部怪物配置已保存到 localStorage。')
    } catch (error) { setMessage(`保存失败：${String(error)}`) }
  }

  /** 技能顺序就是战斗尝试释放的优先级。 */
  function moveSkill(index: number, direction: number) {
    const next = [...monster.skills]
    ;[next[index], next[index + direction]] = [next[index + direction], next[index]]
    updateMonster({ skills: next })
  }

  /** 导入外部文件先校验，用户确认后替换草稿，仍需点击保存才落入本地存储。 */
  async function importFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    if (!file) return
    try {
      const next = parseMonsterDocument(await file.text())
      if (!window.confirm('导入将替换当前全部怪物草稿，是否继续？')) return
      setDocument(next)
      setSelectedId(next.monsters[0].id)
      setSearch('')
      setMessage('文件已导入草稿，点击“保存配置”后写入本地。')
    } catch (error) { setMessage(`导入失败：${String(error)}`) }
    finally { event.target.value = '' }
  }

  /** 支持时写入用户选择的文件，否则通过下载导出；两种方式均不修改项目源码。 */
  async function exportFile() {
    try {
      const json = JSON.stringify(parseMonsterDocument(JSON.stringify(document)), null, 2)
      const picker = (window as Window & SaveFileWindow).showSaveFilePicker
      if (picker) {
        const handle = await picker.call(window, { suggestedName: 'monsters.json', types: [{ description: '怪物配置 JSON', accept: { 'application/json': ['.json'] } }] })
        const writer = await handle.createWritable()
        await writer.write(json)
        await writer.close()
      } else {
        const url = URL.createObjectURL(new Blob([json], { type: 'application/json' }))
        const link = window.document.createElement('a')
        link.href = url
        link.download = 'monsters.json'
        link.click()
        setTimeout(() => URL.revokeObjectURL(url), 1000)
      }
      setMessage('配置文件已导出；浏览器本地保存请点击“保存配置”。')
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') return
      setMessage(`导出失败：${String(error)}`)
    }
  }

  /** 丢弃所有尚未保存的修改，恢复最近一次本地保存快照。 */
  function cancelChanges() {
    if (!window.confirm('确定放弃全部未保存修改？')) return
    setDocument(saved)
    setSelectedId(saved.monsters[0].id)
    setMessage('已恢复最近保存的配置。')
  }

  return (
    <div className="monster-editor">
      <header className="monster-editor__header"><div><p>LEGEND WORLD / CONFIGURATION</p><h1>怪物配置编辑器</h1></div><a href="#" onClick={(event) => { if (dirty && !window.confirm('未保存的修改将丢失，确定返回游戏？')) event.preventDefault() }}>返回游戏 ↗</a></header>
      <div className="monster-editor__toolbar"><span>{document.monsters.length} 个怪物 · {dirty ? '有未保存修改' : '无未保存修改'}</span><div><button type="button" onClick={() => importInput.current!.click()}>导入 JSON</button><button type="button" onClick={exportFile}>导出 / 保存文件</button><input ref={importInput} type="file" accept=".json,application/json" hidden onChange={importFile} /></div></div>
      <div className="monster-editor__layout">
        <aside><div className="monster-editor__section-title"><h2>怪物列表</h2><button type="button" onClick={() => addMonster(false)}>＋ 新增</button></div><input aria-label="搜索怪物名称或 ID" placeholder="搜索名称 / ID" value={search} onChange={(event) => setSearch(event.target.value)} />
          <nav aria-label="怪物列表">{document.monsters.filter((item) => `${item.name} ${item.id}`.toLowerCase().includes(search.toLowerCase())).map((item) => <button type="button" key={item.id} aria-current={item.id === selectedId ? 'true' : undefined} onClick={() => setSelectedId(item.id)}><strong>{item.name}</strong><small>{item.id}</small><small>{ranks[item.rank]} · Lv.{item.level}</small></button>)}{!document.monsters.some((item) => `${item.name} ${item.id}`.toLowerCase().includes(search.toLowerCase())) && <p>没有匹配的怪物</p>}</nav>
        </aside>
        <form onSubmit={save}>
          <div className="monster-editor__section-title"><div><h2>{monster.name}</h2><p>配置详情 · 技能按顺序尝试释放</p></div><button type="button" onClick={() => addMonster(true)}>复制当前怪物</button></div>
          <section><h3>01 / 基本信息</h3><div className="monster-editor__fields"><label>怪物 ID<input required value={monster.id} onChange={(event) => updateMonster({ id: event.target.value })} /></label><label>怪物名称<input required value={monster.name} onChange={(event) => updateMonster({ name: event.target.value })} /></label><label>怪物类型<select value={monster.rank} onChange={(event) => updateMonster({ rank: event.target.value as MonsterDefinition['rank'] })}>{Object.entries(ranks).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label><label>等级<input required type="number" min="1" step="1" value={monster.level} onChange={(event) => updateMonster({ level: event.target.valueAsNumber })} /></label><label>击杀经验<input required type="number" min="0" step="1" value={monster.rewards.experience} onChange={(event) => updateMonster({ rewards: { ...monster.rewards, experience: event.target.valueAsNumber } })} /></label></div></section>
          <section><h3>02 / 数值属性</h3><div className="monster-editor__fields">{statFields.map((field) => <label key={field.key}>{field.label}<input required type="number" min={field.min} max={field.max} step={field.step} value={monster.stats[field.key]} onChange={(event) => updateMonster({ stats: { ...monster.stats, [field.key]: event.target.valueAsNumber } })} /></label>)}</div></section>
          <section><div className="monster-editor__section-title"><h3>03 / 技能配置</h3><span>{monster.skills.length} 个技能</span></div><div className="monster-editor__skill-picker"><select aria-label="选择已有技能" value={skillId} onChange={(event) => setSkillId(event.target.value)}>{skills.map((skill) => <option key={skill.id} value={skill.id}>{skill.name} · {skill.type === 'active' ? '主动' : '被动'}</option>)}</select><button type="button" disabled={monster.skills.some((skill) => skill.id === skillId)} onClick={() => updateMonster({ skills: [...monster.skills, skills.find((skill) => skill.id === skillId)!] })}>＋ 关联技能</button></div>
            {monster.skills.length === 0 && <p className="monster-editor__empty">尚未关联技能，战斗时使用普通攻击。</p>}
            <ol className="monster-editor__skills">{monster.skills.map((skill, index) => <li key={`${skill.id}-${index}`}><span className="monster-editor__order">{String(index + 1).padStart(2, '0')}</span><div><strong>{skill.name}</strong><small>{skill.id} · {skill.type === 'active' ? `主动 · 耗魔 ${skill.manaCost} · 冷却 ${skill.cooldownMs / 1000} 秒` : '被动 · 属性加成'}</small></div><div className="monster-editor__skill-actions"><button type="button" aria-label={`上移${skill.name}`} disabled={index === 0} onClick={() => moveSkill(index, -1)}>↑</button><button type="button" aria-label={`下移${skill.name}`} disabled={index === monster.skills.length - 1} onClick={() => moveSkill(index, 1)}>↓</button><button type="button" onClick={() => updateMonster({ skills: monster.skills.filter((_, position) => position !== index) })}>移除</button></div></li>)}</ol>
            <p className="monster-editor__hint">技能效果沿用已有技能定义；当前页面仅配置关联与优先级。已有掉落配置随怪物完整保留。</p>
          </section>
          <footer><p role="status">{message}</p><div><button type="button" disabled={!dirty} onClick={cancelChanges}>取消修改</button><button className="monster-editor__primary" type="submit">保存配置</button></div></footer>
        </form>
      </div>
    </div>
  )
}
