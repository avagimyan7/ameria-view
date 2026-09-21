export const NO_CATEGORY = '__none__'

export function filterTransactions(transactions, filters = {}) {
  const query = filters.query ? String(filters.query).toUpperCase() : null

  return transactions.filter((tx) => {
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
