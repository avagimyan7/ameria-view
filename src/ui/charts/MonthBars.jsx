import { formatMonth } from '../format.js'

const WIDTH = 900
const HEIGHT = 220
const PADDING = 32

export function MonthBars({ months, selected, onSelect }) {
  if (months.length === 0) return null

  const peak = Math.max(...months.flatMap((m) => [m.income, m.expense]), 1)
  const slot = (WIDTH - PADDING * 2) / months.length
  const barWidth = Math.min(28, slot / 3)
  const scale = (value) => ((HEIGHT - PADDING * 2) * value) / peak

  return (
    <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} width="100%" role="img" aria-label="Доходы и расходы по месяцам">
      {months.map((month, index) => {
        const centre = PADDING + slot * index + slot / 2
        const baseline = HEIGHT - PADDING
        const isSelected = month.month === selected
        return (
          <g key={month.month} onClick={() => onSelect?.(month.month)} style={{ cursor: 'pointer' }}>
            <rect
              x={centre - barWidth - 2} y={baseline - scale(month.income)}
              width={barWidth} height={scale(month.income)} fill="var(--income)"
              opacity={isSelected ? 1 : 0.65}
            />
            <rect
              x={centre + 2} y={baseline - scale(month.expense)}
              width={barWidth} height={scale(month.expense)} fill="var(--expense)"
              opacity={isSelected ? 1 : 0.65}
            />
            <text
              x={centre} y={HEIGHT - 10} textAnchor="middle"
              fontSize="11" fill="var(--muted)"
            >
              {formatMonth(month.month).split(' ')[0].slice(0, 3)}
            </text>
          </g>
        )
      })}
    </svg>
  )
}
