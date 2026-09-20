import { describe, it, expect } from 'vitest'
import { unzipSync, strFromU8 } from 'fflate'
import { buildWorkbook } from './buildWorkbook.js'

describe('buildWorkbook', () => {
  it('создаёт ZIP с листом и таблицей общих строк', () => {
    const bytes = buildWorkbook([['Ամսաթիվ', 'Գումար'], ['19-09-2026', '3000.0']])
    const files = unzipSync(bytes)

    expect(Object.keys(files)).toEqual(
      expect.arrayContaining([
        '[Content_Types].xml',
        '_rels/.rels',
        'xl/workbook.xml',
        'xl/_rels/workbook.xml.rels',
        'xl/worksheets/sheet1.xml',
        'xl/sharedStrings.xml',
      ]),
    )

    const sheet = strFromU8(files['xl/worksheets/sheet1.xml'])
    expect(sheet).toContain('<row r="1">')
    expect(sheet).toContain('r="A2"')

    const shared = strFromU8(files['xl/sharedStrings.xml'])
    expect(shared).toContain('Ամսաթիվ')
    expect(shared).toContain('19-09-2026')
  })

  it('пропускает пустые ячейки, сохраняя буквы колонок', () => {
    const bytes = buildWorkbook([['A', null, 'C']])
    const sheet = strFromU8(unzipSync(bytes)['xl/worksheets/sheet1.xml'])
    expect(sheet).toContain('r="A1"')
    expect(sheet).not.toContain('r="B1"')
    expect(sheet).toContain('r="C1"')
  })

  it('экранирует спецсимволы XML', () => {
    const bytes = buildWorkbook([['Ա & Բ <тест>']])
    const shared = strFromU8(unzipSync(bytes)['xl/sharedStrings.xml'])
    expect(shared).toContain('Ա &amp; Բ &lt;тест&gt;')
  })
})
