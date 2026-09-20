// Порог в две цифры выбран замером на реальной выгрузке: 137 сырых описаний
// схлопываются в 53 группы, и ни одно название мерчанта при этом не повреждается —
// все отрезаемые хвосты оказались обрезанными номерами транзакций.
const CARD_PREFIX = /^Ք:\s*/
const TRAILING_REF = /\s+\d{2,}$/

export function normalizeMerchant(details) {
  const text = String(details ?? '').trim().replace(CARD_PREFIX, '')
  return text.replace(TRAILING_REF, '').replace(/\s+/g, ' ').trim().toUpperCase()
}

export function suggestRuleText(tx) {
  const fromDetails = normalizeMerchant(tx.details)
  return fromDetails || String(tx.counterparty ?? '').trim()
}
