import { createContext, useContext, useState } from 'react'
import { createPortal } from 'react-dom'
import { TabIcons } from './Icons.jsx'

const SCREENS = [
  ['overview', 'Обзор'],
  ['categories', 'Категории'],
  ['transactions', 'Операции'],
  ['import', 'Импорт'],
  ['settings', 'Настройки'],
]

// Заголовок экрана рисует сам экран (у каждого свои кнопки справа), а место ему
// даёт каркас: на компьютере заголовок и вкладки стоят в одной строке. Поэтому
// заголовок уезжает порталом в слот каркаса. undefined — экран отрисован вне
// каркаса (так его проверяют тесты): тогда заголовок остаётся на месте.
const HeaderSlot = createContext(undefined)

export function Layout({ screen, onNavigate, children }) {
  const [slot, setSlot] = useState(null)
  return (
    <div className="layout">
      <header className="topbar">
        <div className="topbar-main" ref={setSlot} />
        {/* Одна и та же навигация: CSS ставит её панелью внизу на телефоне
            и сегментами в строку заголовка на компьютере. */}
        <nav className="tabs" aria-label="Разделы">
          {SCREENS.map(([id, title]) => {
            const Icon = TabIcons[id]
            return (
              <button key={id} type="button" aria-current={screen === id} onClick={() => onNavigate(id)}>
                <Icon />
                {title}
              </button>
            )
          })}
        </nav>
      </header>
      <HeaderSlot.Provider value={slot}>
        <main>{children}</main>
      </HeaderSlot.Provider>
    </div>
  )
}

export function ScreenHeader({ title, subtitle, children }) {
  const slot = useContext(HeaderSlot)
  const header = (
    <div className="screen-header">
      <div style={{ minWidth: 0 }}>
        <h1>{title}</h1>
        {subtitle && <div className="screen-subtitle desktop-only">{subtitle}</div>}
      </div>
      {children && <div className="screen-actions">{children}</div>}
    </div>
  )
  if (slot === undefined) return header
  return slot ? createPortal(header, slot) : null
}
