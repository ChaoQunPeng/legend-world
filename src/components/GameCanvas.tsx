import { useEffect, useRef, useState } from 'react'
import { Game } from '../game/Game'
import type { LocalWorld } from '../game/data/localWorld'

/** 画布宿主：连接 React 与游戏生命周期，不承担逐帧状态更新。 */
export function GameCanvas({ localWorld }: { localWorld: LocalWorld }) {
  const hostRef = useRef<HTMLDivElement>(null)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    // effect 执行时宿主已挂载，该实例与本次挂载一一对应。
    const game = new Game(hostRef.current!, localWorld)
    let active = true

    void game.init().catch((error: unknown) => {
      // 浏览器图形能力可能导致初始化失败；旧实例卸载后不再更新界面。
      if (active) {
        console.error('传奇世界场景初始化失败', error)
        setFailed(true)
        game.destroy()
      }
    })

    return () => {
      active = false
      game.destroy()
    }
  }, [localWorld])

  return (
    <div className="game-canvas" role="img" aria-label={`传奇世界初始场景：月光下的群山与古老石门，角色${localWorld.character.name}与怪物${localWorld.monster.name}`}>
      <div ref={hostRef} className="game-canvas__host" />
      {failed && (
        <p className="game-canvas__error" role="alert">
          世界暂时无法显示，请检查浏览器的图形加速设置后刷新。
        </p>
      )}
    </div>
  )
}
