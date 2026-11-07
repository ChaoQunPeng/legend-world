import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './app/App.tsx'
import './styles/global.css'

// root 由 index.html 固定提供；保留 StrictMode，后续确保游戏资源能够完整清理。
createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
