import { STATUS_APPROVED } from '../domain/constants.js'

export const NO_CATEGORY = '__none__'

const COUNTABLE_DIRECTIONS = new Set(['expense', 'income'])

function isCountable(tx) {
  return tx.status === STATUS_APPROVED && COUNTABLE_DIRECTIONS.has(tx.direction)
}

export function filterTransactions(transactions, filters = {}) {
  const query = filters.query ? String(filters.query).toUpperCase() : null

  return transactions.filter((tx) => {
    // If countableOnly is set, exclude non-countable transactions
    if (filters.countableOnly && !isCountable(tx)) return false

    if (query) {
      const haystack = `${tx.details} ${tx.counterparty} ${tx.comment}`.toUpperCase()
      if (!haystack.includes(query)) return false
    }
    if (filters.from && tx.date < filters.from) return false
    if (filters.to && tx.date > filters.to) return false
    if (filters.direction && tx.direction !== filters.direction) return false
    if (filters.opType && tx.opType !== filters.opType) return false
    if (filters.account && tx.fromAccount !== filters.account && tx.toAccount !== filters.account) {
      return false
    }
    if (filters.categoryId === NO_CATEGORY) {
      if (tx.categoryId) return false
    } else if (filters.categoryId && tx.categoryId !== filters.categoryId) {
      return false
    }
    if (filters.minAmount != null && tx.amount < filters.minAmount) return false
    if (filters.maxAmount != null && tx.amount > filters.maxAmount) return false
    return true
  })
}
