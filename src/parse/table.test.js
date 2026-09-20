import { describe, it, expect } from 'vitest'
import { buildWorkbook } from '../../test/fixtures/buildWorkbook.js'
import { readSheetRows } from './xlsx.js'
import { toNamedRows } from './table.js'
import { HEADERS } from '../domain/constants.js'

const HEADER_ROW = [
  HEADERS.date, HEADERS.docNo, HEADERS.opType, HEADERS.fromAccount, HEADERS.toAccount,
  HEADERS.counterparty, HEADERS.details, HEADERS.status, HEADERS.comment, HEADERS.amount,
  HEADERS.currency,
]

const DATA_ROW = [
  '19-09-2026', '31', 'Քարտային գործարք', '1570000000000001', '1570000000000002',
  'TEST COUNTERPARTY', 'Ք: ASK 23 LLC YEREVAN AM 887772', 'Հաստատված', '', '3000.0', 'AMD',
]

const named = (rows) => toNamedRows(readSheetRows(buildWorkbook(rows)))

describe('toNamedRows', () => {
  it('находит заголовки под многострочной шапкой банка', () => {
    const rows = named([
      ['логотип'], ['+374 10 56 11 11'], ['info@ameriabank.am'], ['Պատմություն'],
      ['TEST USER'], [], ['22-07-2026-20-09-2026'], HEADER_ROW, DATA_ROW,
    ])
    expect(rows).toHaveLength(1)
    expect(rows[0].details).toBe('Ք: ASK 23 LLC YEREVAN AM 887772')
    expect(rows[0].amount).toBe('3000.0')
  })

  it('сопоставляет колонки по именам, а не по позициям', () => {
    const swapped = [...HEADER_ROW]
    const swappedData = [...DATA_ROW]
    ;[swapped[9], swapped[10]] = [swapped[10], swapped[9]]
    ;[swappedData[9], swappedData[10]] = [swappedData[10], swappedData[9]]

    const rows = named([swapped, swappedData])
    expect(rows[0].amount).toBe('3000.0')
    expect(rows[0].currency).toBe('AMD')
  })

  it('терпит хвостовые пробелы в заголовках', () => {
    const padded = HEADER_ROW.map((h) => `${h} `)
    const rows = named([padded, DATA_ROW])
    expect(rows[0].fromAccount).toBe('1570000000000001')
  })

  it('останавливается на первой строке без даты', () => {
    const rows = named([HEADER_ROW, DATA_ROW, [], DATA_ROW])
    expect(rows).toHaveLength(1)
  })

  it('подставляет пустую строку для отсутствующих ячеек', () => {
    const rows = named([HEADER_ROW, DATA_ROW])
    expect(rows[0].comment).toBe('')
  })

  it('называет недостающие заголовки в тексте ошибки', () => {
    const broken = HEADER_ROW.filter((h) => h !== HEADERS.amount)
    expect(() => named([broken, DATA_ROW])).toThrow(/Գումար/)
  })
})
