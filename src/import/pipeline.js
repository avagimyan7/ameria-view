import { readSheetRows } from '../parse/xlsx.js'
import { toNamedRows } from '../parse/table.js'
import { detectOwnAccounts, effectiveOwnAccounts } from './accounts.js'
import { deriveDirections, toTransactions } from './transactions.js'
import { mergeTransactions } from './key.js'

export function importWorkbook(bytes, { existingTransactions = [], ownAccounts = null } = {}) {
  const namedRows = toNamedRows(readSheetRows(bytes))
  // detectedAccounts — только из этого файла: это то, что экран импорта
  // предложит подтвердить. Для расчёта направлений, пока ничего не
  // подтверждено, автоопределение идёт по всей истории сразу — так же,
  // как App пересчитывает направления при загрузке.
  const detectedAccounts = detectOwnAccounts(namedRows)
  const accounts = effectiveOwnAccounts(ownAccounts, [...existingTransactions, ...namedRows])

  const incoming = toTransactions(namedRows, accounts)
  const { merged, added, duplicates } = mergeTransactions(existingTransactions, incoming)
  // Сохранённые операции могли быть классифицированы по старому списку счетов.
  const transactions = deriveDirections(merged, accounts)

  const knownKeys = new Set(existingTransactions.map((tx) => tx.key))
  const dates = incoming.map((tx) => tx.date).sort()

  return {
    transactions,
    detectedAccounts,
    report: {
      rows: namedRows.length,
      added,
      duplicates,
      // Только среди добавленных: повторная загрузка известного файла не должна
      // показывать красное число за операции, которые уже лежат в очереди.
      unresolved: transactions.filter((tx) => !knownKeys.has(tx.key) && tx.direction === 'unresolved').length,
      periodFrom: dates[0] ?? null,
      periodTo: dates[dates.length - 1] ?? null,
    },
  }
}
