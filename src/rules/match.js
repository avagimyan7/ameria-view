function haystack(tx) {
  return `${tx.details ?? ''} ${tx.counterparty ?? ''} ${tx.comment ?? ''}`.toUpperCase()
}

export function ruleMatches(tx, rule) {
  if (rule.direction && tx.direction !== rule.direction) return false
  if (rule.opType && tx.opType !== rule.opType) return false
  return haystack(tx).includes(String(rule.match).toUpperCase())
}

// Приоритет: ручная пометка → текстовое правило → тип операции → без категории.
// Ручная пометка всегда сильнее правила, иначе правило молча перетрёт решение человека.
export function categorize(tx, { rules = [], overrides = {}, opTypeCategories = {} } = {}) {
  const manual = overrides[tx.key]
  if (manual) return manual

  for (const rule of rules) {
    if (ruleMatches(tx, rule)) return rule.category
  }

  return opTypeCategories[tx.opType] ?? null
}

export function applyCategories(transactions, settings) {
  return transactions.map((tx) => ({ ...tx, categoryId: categorize(tx, settings) }))
}

export function rulePreview(transactions, rule) {
  let count = 0
  let amount = 0
  for (const tx of transactions) {
    if (ruleMatches(tx, rule)) {
      count += 1
      amount += tx.amount
    }
  }
  return { count, amount }
}
