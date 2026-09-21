import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import { readSheetRows } from '../src/parse/xlsx.js'
import { toNamedRows } from '../src/parse/table.js'
import { detectOwnAccounts } from '../src/import/accounts.js'
import { toTransactions } from '../src/import/transactions.js'
import { applyCategories } from '../src/rules/match.js'
import { countable, totals, byCategory } from '../src/stats/aggregate.js'
import { defaultSettings } from '../src/store/settings.js'

// Путь строится через fileURLToPath + path.join, а не new URL(relative, import.meta.url):
// в окружении jsdom глобальный URL резолвит относительные пути от http://localhost,
// а не от файла теста, и readFileSync получает URL с чужой схемой.
const fixtureDir = path.join(path.dirname(fileURLToPath(import.meta.url)), 'fixtures')
const bytes = readFileSync(path.join(fixtureDir, 'history-anon.xls'))
const namedRows = toNamedRows(readSheetRows(bytes))
const ownAccounts = detectOwnAccounts(namedRows)
const transactions = toTransactions(namedRows, ownAccounts)

describe('сквозной разбор реальной выгрузки', () => {
  it('разбирает все строки файла', () => {
    expect(namedRows).toHaveLength(254)
  })

  it('находит счета владельца', () => {
    expect(ownAccounts).toHaveLength(4)
  })

  it('классифицирует каждую операцию, не оставляя неопознанных', () => {
    const counts = transactions.reduce((acc, tx) => {
      acc[tx.direction] = (acc[tx.direction] ?? 0) + 1
      return acc
    }, {})
    expect(counts).toEqual({ expense: 214, income: 11, internal: 29 })
    expect(counts.unresolved).toBeUndefined()
  })

  it('выдаёт уникальный ключ каждой операции', () => {
    expect(new Set(transactions.map((tx) => tx.key)).size).toBe(254)
  })

  it('исключает внутренние переводы из статистики', () => {
    expect(countable(transactions)).toHaveLength(225)
  })

  it('стартовые правила покрывают большую часть операций', () => {
    const categorized = applyCategories(transactions, defaultSettings())
    const counted = countable(categorized)
    const withCategory = counted.filter((tx) => tx.categoryId).length
    expect(withCategory / counted.length).toBeGreaterThan(0.6)
  })

  it('сумма по категориям сходится с итогом расходов', () => {
    const categorized = applyCategories(transactions, defaultSettings())
    const sum = byCategory(categorized, 'expense').reduce((acc, row) => acc + row.amount, 0)
    expect(sum).toBe(totals(categorized).expense)
  })
})
