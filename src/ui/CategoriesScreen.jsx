import { useMemo } from 'react'
import { byCategory, uncategorized } from '../stats/aggregate.js'
import { budgetProgress } from '../stats/budget.js'
import { monthOf } from '../import/date.js'
import { CategoryBars } from './charts/CategoryBars.jsx'
import { formatMoney, formatMonth, pluralRu } from './format.js'

export function CategoriesScreen({
  transactions, categories, budgets, month, today, onChangeBudget, onShowUncategorized, currency = null,
}) {
  const inMonth = useMemo(
    () => transactions.filter((tx) => monthOf(tx.date) === month),
    [transactions, month],
  )
  const rows = byCategory(inMonth, 'expense', currency)
  const pending = uncategorized(transactions, currency)
  const pendingAmount = pending.reduce((acc, tx) => acc + tx.amount, 0)
  const progress = budgetProgress(transactions, budgets, month, today, currency)
  const nameOf = (id) => categories.find((c) => c.id === id)?.name ?? id

  // Create a map of actual spending by category for the month
  const spentByCategory = useMemo(() => {
    const map = new Map()
    for (const row of rows) {
      map.set(row.categoryId, row.amount)
    }
    return map
  }, [rows])

  return (
    <div>
      <div className="panel">
        <h3 data-testid="categories-heading">Расходы по категориям за {formatMonth(month)}</h3>
        <CategoryBars rows={rows} categories={categories} currency={currency} />
      </div>

      {pending.length > 0 && (
        <div className="panel" style={{ marginTop: 12 }}>
          {/* Полосы выше — за один месяц, а очередь — за всё время и вместе с доходами:
              её задача разобрать весь накопившийся хвост. Масштаб назван явно, чтобы
              два числа на одном экране не выглядели противоречием. */}
          <h3>Без категории</h3>
          <p data-testid="uncategorized-summary">
            За весь период, доходы и расходы вместе: {pending.length}{' '}
            {pluralRu(pending.length, ['операция', 'операции', 'операций'])}
            {' '}на {formatMoney(pendingAmount, currency)}. Начни с самых крупных —
            в них лежит почти весь неопознанный оборот.
          </p>
          <button type="button" onClick={onShowUncategorized}>Разобрать</button>
        </div>
      )}

      <div className="panel" style={{ marginTop: 12 }}>
        <h3>Бюджеты</h3>
        <table>
          <thead>
            <tr>
              <th>Категория</th>
              <th className="num">Лимит, ֏</th>
              <th className="num">Потрачено</th>
              <th className="num">Прогноз</th>
              <th>Перерасход</th>
            </tr>
          </thead>
          <tbody>
            {categories.map((category) => {
              const row = progress.find((item) => item.categoryId === category.id)
              const limit = budgets[category.id] ?? 0
              const spent = spentByCategory.get(category.id) ?? 0
              const projectedTotal = row?.projectedTotal ?? 0
              const overrunDay = row?.overrunDay ?? null

              // Show "превышен" if limit is exceeded, otherwise show forecast day
              const overrunText = limit > 0 && spent > limit
                ? 'превышен'
                : overrunDay ? `с ${overrunDay}-го числа` : ''

              return (
                <tr key={category.id}>
                  <td>{nameOf(category.id)}</td>
                  <td className="num">
                    <input
                      data-testid={`budget-${category.id}-limit`}
                      type="number"
                      value={Math.round(limit / 100)}
                      style={{ width: 90 }}
                      min="0"
                      onChange={(event) => {
                        const value = Math.max(0, Number(event.target.value))
                        onChangeBudget(category.id, Math.round(value * 100))
                      }}
                    />
                  </td>
                  <td className="num" data-testid={`budget-${category.id}-spent`}>
                    {formatMoney(spent, currency)}
                  </td>
                  <td className="num" data-testid={`budget-${category.id}-projected`}>
                    {limit > 0 ? formatMoney(projectedTotal, currency) : ''}
                  </td>
                  <td className="expense" data-testid={`budget-${category.id}-overrun`}>
                    {overrunText}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
