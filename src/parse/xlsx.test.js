import { describe, it, expect } from 'vitest'
import { buildWorkbook } from '../../test/fixtures/buildWorkbook.js'
import { readSheetRows } from './xlsx.js'

describe('readSheetRows', () => {
  it('читает строковые ячейки через таблицу общих строк', () => {
    const rows = readSheetRows(buildWorkbook([['Ամսաթիվ', 'Գումար'], ['19-09-2026', '3000.0']]))
    expect(rows).toHaveLength(2)
    expect(rows[0].cells).toEqual({ A: 'Ամսաթիվ', B: 'Գումար' })
    expect(rows[1].cells).toEqual({ A: '19-09-2026', B: '3000.0' })
  })

  it('читает числовые ячейки без атрибута типа', () => {
    const rows = readSheetRows(buildWorkbook([[42, 'AMD']]))
    expect(rows[0].cells.A).toBe('42')
    expect(rows[0].cells.B).toBe('AMD')
  })

  it('не создаёт ключей для пустых ячеек и сохраняет буквы колонок', () => {
    const rows = readSheetRows(buildWorkbook([['A', null, 'C']]))
    expect(rows[0].cells).toEqual({ A: 'A', C: 'C' })
  })

  it('возвращает номер строки листа', () => {
    const rows = readSheetRows(buildWorkbook([['раз'], ['два']]))
    expect(rows.map((r) => r.row)).toEqual([1, 2])
  })

  it('внятно ругается, если листа нет', () => {
    const notAWorkbook = buildWorkbook([['x']])
    const broken = notAWorkbook.slice(0, 40)
    expect(() => readSheetRows(broken)).toThrow()
  })
})
