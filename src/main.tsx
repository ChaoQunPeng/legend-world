import { StrictMode, useEffect, useState } from 'react'
import { createRoot } from 'react-dom/client'
import App from './app/App.tsx'
import { MonsterEditor } from './components/MonsterEditor'
import './styles/global.css'

/** 使用独立哈希地址打开配置工具，切换页面时卸载原页面及其战斗时钟。 */
function RootPage() {
  const [hash, setHash] = useState(window.location.hash)
  useEffect(() => {
    const updateHash = () => setHash(window.location.hash)
    window.addEventListener('hashchange', updateHash)
    return () => window.removeEventListener('hashchange', updateHash)
  }, [])
  return hash === '#/monster-editor' ? <MonsterEditor /> : <App />
}

// root 由 index.html 固定提供；保留 StrictMode，后续确保游戏资源能够完整清理。
createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <RootPage />
  </StrictMode>,
)
