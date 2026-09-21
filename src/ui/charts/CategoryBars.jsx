import { formatAmd } from '../format.js'

export function CategoryBars({ rows, categories }) {
  if (rows.length === 0) return null
  const peak = Math.max(...rows.map((row) => row.amount), 1)
  const nameOf = (id) => categories.find((c) => c.id === id)?.name ?? 'Без категории'
  const colourOf = (id) => categories.find((c) => c.id === id)?.color ?? '#868e96'

  return (
    <div>
      {rows.map((row) => (
        <div key={row.categoryId ?? 'none'} style={{ marginBottom: 10 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14 }}>
            <span>{nameOf(row.categoryId)}</span>
            <span>{formatAmd(row.amount)}</span>
          </div>
          <div style={{ background: 'var(--line)', borderRadius: 3, height: 8 }}>
            <div style={{
              width: `${(row.amount / peak) * 100}%`, height: '100%',
              background: colourOf(row.categoryId), borderRadius: 3,
            }} />
          </div>
        </div>
      ))}
    </div>
  )
}
