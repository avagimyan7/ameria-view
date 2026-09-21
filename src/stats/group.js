import { isCountable } from './aggregate.js'

// Операции по дням — для списка «Операции». Группы идут в порядке списка:
// соседние операции одного дня — одна группа. Поэтому при сортировке по сумме
// день может встретиться несколько раз — это честнее, чем тихо перетасовать список.
//
// Итог дня — пришло и ушло отдельно, только по учитываемым операциям (как во
// всех суммах приложения) и только когда весь день в одной валюте: курсов банк
// не даёт, складывать драмы с долларами нельзя.
export function groupByDay(transactions) {
  const groups = []
  for (const tx of transactions) {
    let group = groups[groups.length - 1]
    if (!group || group.date !== tx.date) {
      group = { date: tx.date, items: [], income: 0, expense: 0, currencies: new Set() }
      groups.push(group)
    }
    group.items.push(tx)
    group.currencies.add(tx.currency)
    if (!isCountable(tx)) continue
    if (tx.direction === 'income') group.income += tx.amount
    else group.expense += tx.amount
  }
  return groups.map(({ currencies, ...group }) => ({
    ...group,
    currency: currencies.size === 1 ? [...currencies][0] : null,
  }))
}
