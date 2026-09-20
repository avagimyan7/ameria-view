import { OP } from '../domain/constants.js'

// Засев: оба счёта из строк, которые банк сам пометил как перевод между своими
// счетами, плюс счета списания карточных операций (списать с чужой карты нельзя).
export function detectOwnAccounts(namedRows) {
  const own = new Set()
  for (const row of namedRows) {
    if (row.opType === OP.BETWEEN_OWN) {
      if (row.fromAccount) own.add(row.fromAccount)
      if (row.toAccount) own.add(row.toAccount)
    }
  }
  for (const row of namedRows) {
    if (row.opType === OP.CARD && row.fromAccount) own.add(row.fromAccount)
  }
  return Array.from(own).sort()
}
