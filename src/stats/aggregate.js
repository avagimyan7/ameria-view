import { STATUS_APPROVED } from '../domain/constants.js'
import { monthOf } from '../import/date.js'
import { normalizeMerchant } from '../rules/normalize.js'

const COUNTABLE_DIRECTIONS = new Set(['expense', 'income'])

// Единственное определение «учитываемой» операции: подтверждён и это доход/расход.
// filter.js импортирует этот же предикат для countableOnly — так правило не может
// незаметно разойтись между экраном очереди разбора и фильтром списка операций.
export function isCountable(tx) {
  return tx.status === STATUS_APPROVED && COUNTABLE_DIRECTIONS.has(tx.direction)
}

// Валюты, встреченные среди учитываемых операций, отсортированные по коду.
// Используется, чтобы решить, нужен ли вообще переключатель валют (нет смысла
// показывать его, пока все операции в одной валюте) и чем его заполнить.
export function currenciesOf(transactions) {
  const found = new Set()
  for (const tx of transactions) {
    if (isCountable(tx)) found.add(tx.currency)
  }
  return Array.from(found).sort()
}

// В статистику идут только подтверждённые доходы и расходы.
// Внутренние переводы и операции без опознанных счетов исключены сознательно:
// иначе перекладывание денег между своими счетами раздувает и доход, и расход.
//
// Курсов в выгрузке банка нет, поэтому складывать разные валюты нельзя.
// Если валюта передана явно, фильтруем по ней. Если нет, а в данных несколько
// валют — это ошибка, а не повод угадывать и молча просуммировать AMD с USD.
export function countable(transactions, currency = null) {
  const rows = transactions.filter(isCountable)
  if (currency) return rows.filter((tx) => tx.currency === currency)

  const currencies = new Set(rows.map((tx) => tx.currency))
  if (currencies.size > 1) {
    throw new Error(
      `В данных несколько валют (${Array.from(currencies).sort().join(', ')}). ` +
        'Курсов банк не даёт, поэтому нужно выбрать валюту.',
    )
  }
  return rows
}

export function totals(transactions, currency = null) {
  let income = 0
  let expense = 0
  for (const tx of countable(transactions, currency)) {
    if (tx.direction === 'income') income += tx.amount
    else expense += tx.amount
  }
  return { income, expense, net: income - expense }
}

export function byMonth(transactions, currency = null) {
  const months = new Map()
  for (const tx of countable(transactions, currency)) {
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

function groupBy(transactions, direction, keyOf, keyName, currency) {
  const groups = new Map()
  for (const tx of countable(transactions, currency)) {
    if (tx.direction !== direction) continue
    const key = keyOf(tx)
    if (!groups.has(key)) groups.set(key, { [keyName]: key, amount: 0, count: 0 })
    const row = groups.get(key)
    row.amount += tx.amount
    row.count += 1
  }
  return Array.from(groups.values()).sort((a, b) => b.amount - a.amount)
}

export function byCategory(transactions, direction = 'expense', currency = null) {
  return groupBy(transactions, direction, (tx) => tx.categoryId ?? null, 'categoryId', currency)
}

export function byMerchant(transactions, direction = 'expense', currency = null) {
  return groupBy(transactions, direction, (tx) => normalizeMerchant(tx.details), 'merchant', currency)
}

// Сортировка по убыванию суммы: неразобранные переводы держат основную массу денег,
// поэтому разбирать их имеет смысл сверху вниз.
export function uncategorized(transactions, currency = null) {
  return countable(transactions, currency)
    .filter((tx) => !tx.categoryId)
    .sort((a, b) => b.amount - a.amount)
}
