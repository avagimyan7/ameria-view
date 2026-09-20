import { describe, it, expect } from 'vitest'
import { parseDate, monthOf } from './date.js'

describe('parseDate', () => {
  it('переводит DD-MM-YYYY в ISO', () => {
    expect(parseDate('19-09-2026')).toBe('2026-09-19')
    expect(parseDate('01-01-2025')).toBe('2025-01-01')
  })

  it('бросает исключение на несуществующей дате', () => {
    expect(() => parseDate('32-01-2026')).toThrow(/дату/)
    expect(() => parseDate('29-02-2025')).toThrow(/дату/)
    expect(() => parseDate('2026-09-19')).toThrow(/дату/)
    expect(() => parseDate('')).toThrow(/дату/)
  })
})

describe('monthOf', () => {
  it('отрезает день', () => {
    expect(monthOf('2026-09-19')).toBe('2026-09')
  })
})
