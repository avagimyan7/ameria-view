import { parseAmount } from './money.js'
import { parseDate } from './date.js'
import { assignKeys } from './key.js'

function directionOf(tx, own) {
  const fromMine = own.has(tx.fromAccount)
  const toMine = own.has(tx.toAccount)
  if (fromMine && toMine) return 'internal'
  if (fromMine) return 'expense'
  if (toMine) return 'income'
  return 'unresolved'
}

// Направление — производное от списка своих счетов, а не свойство операции:
// когда человек подтверждает новый счёт C, давний перевод A→C обязан сразу
// стать внутренним, без повторного импорта. Поэтому приложение пересчитывает
// его при загрузке, после импорта и при каждой смене настроек — как категорию.
export function deriveDirections(transactions, ownAccounts) {
  const own = new Set(ownAccounts)
  return transactions.map((tx) => ({ ...tx, direction: directionOf(tx, own) }))
}

export function toTransactions(namedRows, ownAccounts) {
  const own = new Set(ownAccounts)

  const mapped = namedRows.map((row, index) => {
    let date
    let amount
    try {
      date = parseDate(row.date)
      amount = parseAmount(row.amount)
    } catch (error) {
      throw new Error(`Строка ${index + 1}: ${error.message}`)
    }

    return {
      date,
      opType: row.opType,
      fromAccount: row.fromAccount,
      toAccount: row.toAccount,
      counterparty: row.counterparty,
      details: row.details,
      comment: row.comment,
      status: row.status,
      amount,
      currency: row.currency,
      direction: directionOf(row, own),
      categoryId: null,
    }
  })

  return assignKeys(mapped)
}
