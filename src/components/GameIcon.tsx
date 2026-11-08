/** 使用统一的 24px 线性图标，匹配参考稿的描边粗细与尺寸，不引入图标运行时。 */
export function GameIcon({ name }: { name: 'compass' | 'user' | 'backpack' | 'zap' | 'message' | 'heart' | 'trend' | 'target' }) {
  const paths = {
    compass: <><circle cx="12" cy="12" r="10" /><path d="m16.2 7.8-2.4 6-6 2.4 2.4-6z" /></>,
    user: <><circle cx="12" cy="8" r="4" /><path d="M20 21v-2a6 6 0 0 0-6-6h-4a6 6 0 0 0-6 6v2" /></>,
    backpack: <><path d="M9 5V3h6v2M6 8a3 3 0 0 1 3-3h6a3 3 0 0 1 3 3v12H6zM6 12H3v7h3m12-7h3v7h-3M9 14h6v6H9z" /></>,
    zap: <path d="m13 2-3 8H4l7 12 3-8h6z" />,
    message: <path d="M21 15a3 3 0 0 1-3 3H8l-5 4V6a3 3 0 0 1 3-3h12a3 3 0 0 1 3 3z" />,
    heart: <path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1.1-1.1a5.5 5.5 0 0 0-7.8 7.8L12 21l8.8-8.6a5.5 5.5 0 0 0 0-7.8z" />,
    trend: <><path d="m3 17 6-6 4 4 8-10M15 5h6v6" /></>,
    target: <><circle cx="12" cy="12" r="8" /><path d="M12 2v4m0 12v4M2 12h4m12 0h4" /><circle cx="12" cy="12" r="2" /></>,
  }
  return <svg className="game-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{paths[name]}</svg>
}
