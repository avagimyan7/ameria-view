import { readSheetRows } from '../parse/xlsx.js'
import { toNamedRows } from '../parse/table.js'
import { detectOwnAccounts } from './accounts.js'
import { toTransactions } from './transactions.js'
import { mergeTransactions } from './key.js'

export function importWorkbook(bytes, { existingTransactions = [], ownAccounts = null } = {}) {
  const namedRows = toNamedRows(readSheetRows(bytes))
  const detectedAccounts = detectOwnAccounts(namedRows)
  const accounts = ownAccounts && ownAccounts.length ? ownAccounts : detectedAccounts

  const incoming = toTransactions(namedRows, accounts)
  const { merged, added, duplicates } = mergeTransactions(existingTransactions, incoming)

  const dates = incoming.map((tx) => tx.date).sort()

  return {
    transactions: merged,
    detectedAccounts,
    report: {
      rows: namedRows.length,
      added,
      duplicates,
      unresolved: incoming.filter((tx) => tx.direction === 'unresolved').length,
      periodFrom: dates[0] ?? null,
      periodTo: dates[dates.length - 1] ?? null,
    },
  }
}
