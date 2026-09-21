import { useMemo } from 'react'
import { byCategory, uncategorized } from '../stats/aggregate.js'
import { budgetProgress } from '../stats/budget.js'
import { monthOf } from '../import/date.js'
import { CategoryBars } from './charts/CategoryBars.jsx'
import { formatAmd } from './format.js'

export function CategoriesScreen({
  transactions, categories, budgets, month, today, onChangeBudget, onShowUncategorized,
}) {
  const inMonth = useMemo(
    () => transactions.filter((tx) => monthOf(tx.date) === month),
    [transactions, month],
  )
  const rows = byCategory(inMonth, 'expense')
  const pending = uncategorized(transactions)
  const pendingAmount = pending.reduce((acc, tx) => acc + tx.amount, 0)
  const progress = budgetProgress(transactions, budgets, month, today)
  const nameOf = (id) => categories.find((c) => c.id === id)?.name ?? id

  return (
    <div>
      <div className="panel">
        <h3>Расходы по категориям</h3>
        <CategoryBars rows={rows} categories={categories} />
      </div>

      {pending.length > 0 && (
        <div className="panel" style={{ marginTop: 12 }}>
          <h3>Без категории</h3>
          <p data-testid="uncategorized-summary">
            {pending.length} операций на {formatAmd(pendingAmount)}. Начни с самых крупных —
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
              return (
                <tr key={category.id}>
                  <td>{nameOf(category.id)}</td>
                  <td className="num">
                    <input
                      data-testid={`budget-${category.id}-limit`}
                      type="number"
                      value={Math.round(limit / 100)}
                      style={{ width: 90 }}
                      onChange={(event) =>
                        onChangeBudget(category.id, Math.round(Number(event.target.value) * 100))
                      }
                    />
                  </td>
                  <td className="num" data-testid={`budget-${category.id}-spent`}>
                    {formatAmd(row?.spent ?? 0)}
                  </td>
                  <td className="num" data-testid={`budget-${category.id}-projected`}>
                    {formatAmd(row?.projectedTotal ?? 0)}
                  </td>
                  <td className="expense" data-testid={`budget-${category.id}-overrun`}>
                    {row?.overrunDay ? `с ${row.overrunDay}-го числа` : ''}
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
