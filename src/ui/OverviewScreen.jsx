import { useMemo, useState } from 'react'
import { totals, byMonth, byCategory, countable } from '../stats/aggregate.js'
import { monthOf } from '../import/date.js'
import { MonthBars } from './charts/MonthBars.jsx'
import { formatAmd, formatMonth } from './format.js'

export function OverviewScreen({ transactions, categories }) {
  const months = useMemo(() => byMonth(transactions), [transactions])
  const [selected, setSelected] = useState(null)
  // Only use selected if it still exists in the current data; fall back to latest month
  const activeMonth = months.some(m => m.month === selected) ? selected : months[months.length - 1]?.month ?? null

  const inMonth = useMemo(
    () => (activeMonth ? transactions.filter((tx) => monthOf(tx.date) === activeMonth) : []),
    [transactions, activeMonth],
  )

  const monthTotals = totals(inMonth)
  const expenses = byCategory(inMonth, 'expense')
  const nameOf = (id) =>
    categories.find((category) => category.id === id)?.name ?? 'Без категории'
  const colourOf = (id) =>
    categories.find((category) => category.id === id)?.color ?? 'var(--muted)'
  const sumOf = (id) => expenses.find((row) => row.categoryId === id)?.amount ?? 0

  if (countable(transactions).length === 0) {
    return <p className="muted">Нет данных — импортируй выгрузку из myAmeria на вкладке «Импорт».</p>
  }

  return (
    <div>
      <div className="panel">
        <MonthBars months={months} selected={activeMonth} onSelect={setSelected} />
      </div>

      <h2>{activeMonth ? formatMonth(activeMonth) : ''}</h2>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
        <div className="panel">
          <div className="muted">Пришло</div>
          <div className="income" data-testid="total-income" style={{ fontSize: 24 }}>
            {formatAmd(monthTotals.income)}
          </div>
        </div>
        <div className="panel">
          <div className="muted">Ушло</div>
          <div className="expense" data-testid="total-expense" style={{ fontSize: 24 }}>
            {formatAmd(monthTotals.expense)}
          </div>
        </div>
        <div className="panel">
          <div className="muted">Осталось</div>
          <div data-testid="total-net" style={{ fontSize: 24 }}>
            {formatAmd(monthTotals.net)}
          </div>
        </div>
      </div>

      <div className="panel" style={{ marginTop: 12 }}>
        <div className="muted">То, что обычно не замечают</div>
        <p>
          Комиссии банка: <strong data-testid="fees-total">{formatAmd(sumOf('fees'))}</strong>
        </p>
        <p>
          Кредит с процентами:{' '}
          <strong data-testid="loan-total">{formatAmd(sumOf('loan_principal') + sumOf('loan_interest'))}</strong>
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
                <td className="num">{formatAmd(row.amount)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
