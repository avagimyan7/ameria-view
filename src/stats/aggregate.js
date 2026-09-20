import { STATUS_APPROVED } from '../domain/constants.js'
import { monthOf } from '../import/date.js'
import { normalizeMerchant } from '../rules/normalize.js'

const COUNTABLE_DIRECTIONS = new Set(['expense', 'income'])

// В статистику идут только подтверждённые доходы и расходы.
// Внутренние переводы и операции без опознанных счетов исключены сознательно:
// иначе перекладывание денег между своими счетами раздувает и доход, и расход.
export function countable(transactions) {
  return transactions.filter(
    (tx) => tx.status === STATUS_APPROVED && COUNTABLE_DIRECTIONS.has(tx.direction),
  )
}

export function totals(transactions) {
  let income = 0
  let expense = 0
  for (const tx of countable(transactions)) {
    if (tx.direction === 'income') income += tx.amount
    else expense += tx.amount
  }
  return { income, expense, net: income - expense }
}

export function byMonth(transactions) {
  const months = new Map()
  for (const tx of countable(transactions)) {
    const month = monthOf(tx.date)
    if (!months.has(month)) months.set(month, { month, income: 0, expense: 0, net: 0 })
    const row = months.get(month)
    if (tx.direction === 'income') row.income += tx.amount
    else row.expense += tx.amount
  }
  return Array.from(months.values())
    .map((row) => ({ ...row, net: row.income - row.expense }))
    .sort((a, b) => a.month.localeCompare(b.month))
}

function groupBy(transactions, direction, keyOf, keyName) {
  const groups = new Map()
  for (const tx of countable(transactions)) {
    if (tx.direction !== direction) continue
    const key = keyOf(tx)
    if (!groups.has(key)) groups.set(key, { [keyName]: key, amount: 0, count: 0 })
    const row = groups.get(key)
    row.amount += tx.amount
    row.count += 1
  }
  return Array.from(groups.values()).sort((a, b) => b.amount - a.amount)
}

export function byCategory(transactions, direction = 'expense') {
  return groupBy(transactions, direction, (tx) => tx.categoryId ?? null, 'categoryId')
}

export function byMerchant(transactions, direction = 'expense') {
  return groupBy(transactions, direction, (tx) => normalizeMerchant(tx.details), 'merchant')
}

// Сортировка по убыванию суммы: неразобранные переводы держат основную массу денег,
// поэтому разбирать их имеет смысл сверху вниз.
export function uncategorized(transactions) {
  return countable(transactions)
    .filter((tx) => !tx.categoryId)
    .sort((a, b) => b.amount - a.amount)
}
