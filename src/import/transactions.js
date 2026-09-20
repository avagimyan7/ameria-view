import { parseAmount } from './money.js'
import { parseDate } from './date.js'
import { assignKeys } from './key.js'

function directionOf(fromMine, toMine) {
  if (fromMine && toMine) return 'internal'
  if (fromMine) return 'expense'
  if (toMine) return 'income'
  return 'unresolved'
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
      direction: directionOf(own.has(row.fromAccount), own.has(row.toAccount)),
      categoryId: null,
    }
  })

  return assignKeys(mapped)
}
