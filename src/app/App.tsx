import { GameCanvas } from '../components/GameCanvas'

/** 传奇世界入口：DOM 展示标题，PixiJS 独立管理游戏世界。 */
export default function App() {
  return (
    <main className="world">
      <GameCanvas />
      <header className="world__header">
        <p className="world__eyebrow" lang="en">LEGEND WORLD</p>
        <h1>传奇世界</h1>
        <p className="world__message">山海之间，传奇初启。</p>
      </header>
      <p className="world__status">初始场景 · 玩法开发中</p>
    </main>
  )
}
