import { describe, it, expect, beforeEach } from 'vitest'
import { loadImports, recordImport, IMPORTS_KEY, MAX_IMPORTS } from './imports.js'

const entry = (over) => ({
  name: 'history.xlsx', size: 1000, importedAt: '2026-09-20', added: 3, duplicates: 0, rows: 3, ...over,
})

describe('история импортов', () => {
  beforeEach(() => localStorage.clear())

  it('пустая, пока ничего не импортировали', () => {
    expect(loadImports()).toEqual([])
  })

  it('новый импорт встаёт первым', () => {
    recordImport(entry({ name: 'a.xlsx' }))
    recordImport(entry({ name: 'b.xlsx' }))
    expect(loadImports().map((item) => item.name)).toEqual(['b.xlsx', 'a.xlsx'])
  })

  it('хранит не больше последних MAX_IMPORTS записей', () => {
    for (let i = 0; i < MAX_IMPORTS + 3; i += 1) recordImport(entry({ name: `${i}.xlsx` }))
    const list = loadImports()
    expect(list).toHaveLength(MAX_IMPORTS)
    expect(list[0].name).toBe(`${MAX_IMPORTS + 2}.xlsx`)
  })

  it('испорченная запись в хранилище не роняет приложение', () => {
    localStorage.setItem(IMPORTS_KEY, '{не json')
    expect(loadImports()).toEqual([])
    localStorage.setItem(IMPORTS_KEY, JSON.stringify({ not: 'a list' }))
    expect(loadImports()).toEqual([])
  })

  it('записи чужого вида отбрасываются', () => {
    localStorage.setItem(IMPORTS_KEY, JSON.stringify([entry(), 'мусор', { name: 5 }]))
    expect(loadImports()).toHaveLength(1)
  })
})
