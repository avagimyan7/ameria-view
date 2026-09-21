import { formatMoney } from '../format.js'

export function CategoryBars({ rows, categories, currency = null }) {
  if (rows.length === 0) return null
  const peak = Math.max(...rows.map((row) => row.amount), 1)
  const nameOf = (id) => categories.find((c) => c.id === id)?.name ?? 'Без категории'
  const colourOf = (id) => categories.find((c) => c.id === id)?.color ?? 'var(--text-3)'

  return (
    <div className="category-bars" data-testid="category-bars">
      {rows.map((row) => (
        <div key={row.categoryId ?? 'none'}>
          <div className="category-bars-line">
            <span>{nameOf(row.categoryId)}</span>
            <strong className="amount">{formatMoney(row.amount, currency)}</strong>
          </div>
          <div className="bar" aria-hidden="true">
            <span style={{ width: `${(row.amount / peak) * 100}%`, background: colourOf(row.categoryId) }} />
          </div>
        </div>
      ))}
    </div>
  )
}
