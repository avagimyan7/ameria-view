import { describe, it, expect } from 'vitest'
import { buildWorkbook } from '../../test/fixtures/buildWorkbook.js'
import { importWorkbook } from './pipeline.js'
import { HEADERS, OP } from '../domain/constants.js'

const HEADER_ROW = [
  HEADERS.date, HEADERS.docNo, HEADERS.opType, HEADERS.fromAccount, HEADERS.toAccount,
  HEADERS.counterparty, HEADERS.details, HEADERS.status, HEADERS.comment, HEADERS.amount,
  HEADERS.currency,
]

const dataRow = (over = {}) => {
  const row = {
    date: '19-09-2026', docNo: '31', opType: OP.CARD, from: 'MINE1', to: 'SHOP',
    counterparty: '', details: 'Ք: ASK 23 LLC 887772', status: 'Հաստատված', comment: '',
    amount: '3000.0', currency: 'AMD', ...over,
  }
  return [row.date, row.docNo, row.opType, row.from, row.to, row.counterparty,
    row.details, row.status, row.comment, row.amount, row.currency]
}

const workbook = (rows) => buildWorkbook([HEADER_ROW, ...rows])

describe('importWorkbook', () => {
  it('разбирает файл и отчитывается о результате', () => {
    const result = importWorkbook(workbook([dataRow(), dataRow({ date: '20-09-2026' })]))
    expect(result.transactions).toHaveLength(2)
    expect(result.report.rows).toBe(2)
    expect(result.report.added).toBe(2)
    expect(result.report.duplicates).toBe(0)
    expect(result.report.periodFrom).toBe('2026-09-19')
    expect(result.report.periodTo).toBe('2026-09-20')
  })

  it('определяет свои счета сам, если их ещё не подтверждали', () => {
    const result = importWorkbook(workbook([dataRow({ from: 'MINE1' })]))
    expect(result.detectedAccounts).toEqual(['MINE1'])
    expect(result.transactions[0].direction).toBe('expense')
  })

  it('уважает подтверждённый список счетов', () => {
    const result = importWorkbook(workbook([dataRow({ from: 'MINE1', to: 'MINE2' })]), {
      ownAccounts: ['MINE1', 'MINE2'],
    })
    expect(result.transactions[0].direction).toBe('internal')
  })

  it('повторная загрузка того же файла не добавляет дублей', () => {
    const bytes = workbook([dataRow()])
    const first = importWorkbook(bytes)
    const second = importWorkbook(bytes, { existingTransactions: first.transactions })
    expect(second.report.added).toBe(0)
    expect(second.report.duplicates).toBe(1)
    expect(second.transactions).toHaveLength(1)
  })

  it('считает операции, требующие внимания', () => {
    const result = importWorkbook(workbook([dataRow({ from: 'X', to: 'Y', opType: OP.TRANSFER_TO_ACCOUNT })]), {
      ownAccounts: ['MINE1'],
    })
    expect(result.report.unresolved).toBe(1)
  })

  it('на файле без единой операции отдаёт пустой отчёт, а не падает', () => {
    const result = importWorkbook(workbook([]))
    expect(result.transactions).toEqual([])
    expect(result.report).toMatchObject({ rows: 0, added: 0, duplicates: 0, unresolved: 0 })
    expect(result.report.periodFrom).toBeNull()
  })
})
