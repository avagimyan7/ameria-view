import { countable } from './aggregate.js'
import { monthOf } from '../import/date.js'

export function daysInMonth(month) {
  const [year, monthNumber] = month.split('-').map(Number)
  return new Date(Date.UTC(year, monthNumber, 0)).getUTCDate()
}

function elapsedDays(month, today) {
  const total = daysInMonth(month)
  const currentMonth = monthOf(today)
  if (currentMonth > month) return total
  if (currentMonth < month) return 0
  return Math.min(total, Number(today.slice(8, 10)))
}

export function budgetProgress(transactions, budgets, month, today, currency = null) {
  const spentByCategory = new Map()
  for (const tx of countable(transactions, currency)) {
    if (tx.direction !== 'expense' || monthOf(tx.date) !== month) continue
    const current = spentByCategory.get(tx.categoryId) ?? 0
    spentByCategory.set(tx.categoryId, current + tx.amount)
  }

  const total = daysInMonth(month)
  const elapsed = elapsedDays(month, today)

  return Object.entries(budgets).map(([categoryId, limit]) => {
    const spent = spentByCategory.get(categoryId) ?? 0
    const dailyRate = elapsed > 0 ? spent / elapsed : 0
    const projectedTotal = Math.round(dailyRate * total)
    const overrunDay =
      limit > 0 && dailyRate > 0 && projectedTotal > limit
        ? Math.min(total, Math.ceil(limit / dailyRate))
        : null

    return {
      categoryId,
      limit,
      spent,
      share: limit > 0 ? spent / limit : 0,
      projectedTotal,
      overrunDay,
    }
  })
}
