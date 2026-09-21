const SCREENS = [
  ['overview', 'Обзор'],
  ['categories', 'Категории'],
  ['transactions', 'Транзакции'],
  ['import', 'Импорт'],
  ['settings', 'Настройки'],
]

export function Layout({ screen, onNavigate, children }) {
  return (
    <div className="layout">
      <nav className="nav">
        {SCREENS.map(([id, title]) => (
          <button
            key={id}
            type="button"
            aria-current={screen === id}
            onClick={() => onNavigate(id)}
          >
            {title}
          </button>
        ))}
      </nav>
      {children}
    </div>
  )
}
