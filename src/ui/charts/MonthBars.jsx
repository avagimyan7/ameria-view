import { formatMonth } from '../format.js'

const WIDTH = 900
const HEIGHT = 200
const PADDING = 32
const TOP = 12

// Подписи месяцев — HTML под графиком, а не текст внутри SVG. График тянется
// на всю ширину экрана, и на телефоне текст внутри него сжимался до четырёх
// пикселей. Сами столбики растягиваются свободно (preserveAspectRatio="none"):
// без текста внутри искажать там нечего.
export function MonthBars({ months, selected, onSelect }) {
  if (months.length === 0) return null

  const peak = Math.max(...months.flatMap((m) => [m.income, m.expense]), 1)
  const slot = (WIDTH - PADDING * 2) / months.length
  const barWidth = Math.min(28, slot / 3)
  const scale = (value) => ((HEIGHT - TOP) * value) / peak
  const inset = `${(PADDING / WIDTH) * 100}%`

  return (
    <div className="chart">
      <svg
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`} preserveAspectRatio="none"
        role="img" aria-label="Доходы и расходы по месяцам"
      >
        {months.map((month, index) => {
          const centre = PADDING + slot * index + slot / 2
          const isSelected = month.month === selected
          return (
            <g key={month.month} onClick={() => onSelect?.(month.month)} style={{ cursor: 'pointer' }}>
              <rect
                x={centre - barWidth - 2} y={HEIGHT - scale(month.income)}
                width={barWidth} height={scale(month.income)} fill="var(--income)"
                opacity={isSelected ? 1 : 0.65}
              />
              <rect
                x={centre + 2} y={HEIGHT - scale(month.expense)}
                width={barWidth} height={scale(month.expense)} fill="var(--expense)"
                opacity={isSelected ? 1 : 0.65}
              />
            </g>
          )
        })}
      </svg>
      <div
        className="chart-labels"
        style={{ gridTemplateColumns: `repeat(${months.length}, 1fr)`, paddingLeft: inset, paddingRight: inset }}
      >
        {months.map((month) => (
          <button
            key={month.month} type="button"
            aria-pressed={month.month === selected}
            onClick={() => onSelect?.(month.month)}
          >
            {formatMonth(month.month).split(' ')[0].slice(0, 3)}
          </button>
        ))}
      </div>
    </div>
  )
}
