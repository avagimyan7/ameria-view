import { describe, it, expect } from 'vitest'
import { parseAmount, formatAmount } from './money.js'

describe('parseAmount', () => {
  it('переводит суммы в целые лумы', () => {
    expect(parseAmount('3000.0')).toBe(300000)
    expect(parseAmount('9.0')).toBe(900)
    expect(parseAmount('0.01')).toBe(1)
    expect(parseAmount('1234')).toBe(123400)
  })

  it('не теряет точность на больших суммах', () => {
    expect(parseAmount('999999999.99')).toBe(99999999999)
  })

  it('принимает запятую как десятичный разделитель и пробелы в разрядах', () => {
    expect(parseAmount('1 234,56')).toBe(123456)
  })

  it('понимает отрицательные суммы', () => {
    expect(parseAmount('-50.25')).toBe(-5025)
  })

  it('бросает исключение на мусоре', () => {
    expect(() => parseAmount('не сумма')).toThrow(/Не удалось разобрать сумму/)
    expect(() => parseAmount('')).toThrow(/Не удалось разобрать сумму/)
  })
})

describe('formatAmount', () => {
  it('прячет нулевые копейки и разделяет разряды', () => {
    expect(formatAmount(300000)).toBe('3 000')
    expect(formatAmount(99999999999)).toBe('999 999 999,99')
    expect(formatAmount(-5025)).toBe('-50,25')
    expect(formatAmount(0)).toBe('0')
  })
})
