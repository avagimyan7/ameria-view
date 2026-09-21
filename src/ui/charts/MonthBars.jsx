import { chartWindow } from '../../stats/months.js'
import { formatMonth } from '../format.js'

const monthName = (month, short) => {
  const name = formatMonth(month).split(' ')[0]
  return short ? name.slice(0, 3) : name
}

function Legend() {
  return (
    <div className="legend">
      <span><i style={{ background: 'var(--income)' }} />пришло</span>
      <span><i style={{ background: 'var(--expense)' }} />ушло</span>
    </div>
  )
}

// Столбики — обычные блоки, а не SVG: так подписи под ними остаются текстом
// нормального размера на любой ширине. Высота — доля от пика в окне.
export function MonthBars({ months, selected, onSelect }) {
  if (months.length === 0) return null
  const shown = chartWindow(months, selected)
  const peak = Math.max(...shown.flatMap((m) => [m.income, m.expense]), 1)
  const height = (value) => (value > 0 ? `max(3px, ${(value / peak) * 100}%)` : '0')
  // Полные названия месяцев влезают, пока месяцев немного.
  const short = shown.length > 4

  return (
    <div className="card chart-card">
      <div className="card-head">
        <div className="card-title">По месяцам</div>
        <Legend />
      </div>
      <div className="chart-bars" aria-hidden="true">
        {shown.map((month) => (
          <div
            key={month.month}
            className={`chart-group${month.month === selected ? ' is-selected' : ''}`}
            onClick={() => onSelect?.(month.month)}
          >
            <span className="chart-bar" style={{ height: height(month.income), background: 'var(--income)' }} />
            <span className="chart-bar" style={{ height: height(month.expense), background: 'var(--expense)' }} />
          </div>
        ))}
      </div>
      <div className="chart-labels">
        {shown.map((month) => (
          <button
            key={month.month} type="button"
            aria-pressed={month.month === selected}
            aria-label={formatMonth(month.month)}
            onClick={() => onSelect?.(month.month)}
          >
            {monthName(month.month, short)}
          </button>
        ))}
      </div>
    </div>
  )
}

// Пустой график для экрана без данных: те же подписи, но без столбиков.
export function MonthBarsPlaceholder({ months }) {
  return (
    <div className="card chart-card is-placeholder" aria-hidden="true">
      <div className="card-head">
        <div className="card-title">По месяцам</div>
        <div className="legend">нет операций</div>
      </div>
      <div className="chart-bars">
        {months.map((month) => (
          <div key={month} className="chart-group">
            <span className="chart-bar" /><span className="chart-bar" />
          </div>
        ))}
      </div>
      <div className="chart-labels">
        {months.map((month) => <span key={month}>{monthName(month, false)}</span>)}
      </div>
    </div>
  )
}
