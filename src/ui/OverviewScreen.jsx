import { useMemo, useState } from 'react'
import { totals, byMonth, byCategory, countable } from '../stats/aggregate.js'
import { monthOf } from '../import/date.js'
import { MonthBars } from './charts/MonthBars.jsx'
import { formatMoney, formatMonth } from './format.js'

export function OverviewScreen({ transactions, categories, currency = null }) {
  const months = useMemo(() => byMonth(transactions, currency), [transactions, currency])
  const [selected, setSelected] = useState(null)
  // Only use selected if it still exists in the current data; fall back to latest month
  const activeMonth = months.some(m => m.month === selected) ? selected : months[months.length - 1]?.month ?? null

  const inMonth = useMemo(
    () => (activeMonth ? transactions.filter((tx) => monthOf(tx.date) === activeMonth) : []),
    [transactions, activeMonth],
  )

  const monthTotals = totals(inMonth, currency)
  const expenses = byCategory(inMonth, 'expense', currency)
  const nameOf = (id) =>
    categories.find((category) => category.id === id)?.name ?? 'Без категории'
  const colourOf = (id) =>
    categories.find((category) => category.id === id)?.color ?? 'var(--muted)'
  const sumOf = (id) => expenses.find((row) => row.categoryId === id)?.amount ?? 0

  if (countable(transactions, currency).length === 0) {
    return <p className="muted">Нет данных — импортируй выгрузку из myAmeria на вкладке «Импорт».</p>
  }

  return (
    <div>
      <div className="panel">
        <MonthBars months={months} selected={activeMonth} onSelect={setSelected} />
      </div>

      <h2>{activeMonth ? formatMonth(activeMonth) : ''}</h2>

      <div className="totals">
        <div className="panel">
          <div className="muted">Пришло</div>
          <div className="income amount" data-testid="total-income">
            {formatMoney(monthTotals.income, currency)}
          </div>
        </div>
        <div className="panel">
          <div className="muted">Ушло</div>
          <div className="expense amount" data-testid="total-expense">
            {formatMoney(monthTotals.expense, currency)}
          </div>
        </div>
        <div className="panel">
          <div className="muted">Осталось</div>
          <div className="amount" data-testid="total-net">
            {formatMoney(monthTotals.net, currency)}
          </div>
        </div>
      </div>

      <div className="panel" style={{ marginTop: 12 }}>
        <div className="muted">То, что обычно не замечают</div>
        <p>
          Комиссии банка: <strong data-testid="fees-total">{formatMoney(sumOf('fees'), currency)}</strong>
        </p>
        <p>
          Кредит с процентами:{' '}
          <strong data-testid="loan-total">{formatMoney(sumOf('loan_principal') + sumOf('loan_interest'), currency)}</strong>
        </p>
      </div>

      <div className="panel" style={{ marginTop: 12 }}>
        <h3>Куда ушли деньги</h3>
        <table>
          <tbody>
            {expenses.map((row) => (
              <tr key={row.categoryId ?? 'none'}>
                <td>
                  <span style={{
                    display: 'inline-block', width: 10, height: 10, borderRadius: 2,
                    background: colourOf(row.categoryId), marginRight: 8,
                  }} />
                  {nameOf(row.categoryId)}
                </td>
                <td className="num muted">{row.count}</td>
                <td className="num">{formatMoney(row.amount, currency)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
