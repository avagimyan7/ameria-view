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

// Подтверждённый список важнее автоопределения, но пустой список — это ещё не
// подтверждение («своих счетов нет»), а его отсутствие: иначе до первого
// подтверждения все переводы между своими счетами считались бы доходами и
// расходами. Пока человек ничего не подтвердил, работаем по автоопределению.
// rows — строки выписки или уже разобранные операции: нужны только
// opType, fromAccount и toAccount, а они у тех и других одинаковые.
export function effectiveOwnAccounts(confirmed, rows) {
  return confirmed && confirmed.length ? confirmed : detectOwnAccounts(rows)
}
