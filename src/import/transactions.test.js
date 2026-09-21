import { describe, it, expect } from 'vitest'
import { toTransactions, deriveDirections } from './transactions.js'
import { OP } from '../domain/constants.js'

const row = (over) => ({
  date: '19-09-2026', docNo: '31', opType: OP.CARD, fromAccount: 'MINE1', toAccount: 'SHOP',
  counterparty: 'ASK 23', details: 'Ք: ASK 23 LLC YEREVAN AM 887772', status: 'Հաստատված',
  comment: '', amount: '3000.0', currency: 'AMD', ...over,
})

const own = ['MINE1', 'MINE2']

describe('toTransactions', () => {
  it('списание с моего счёта — это расход', () => {
    const [tx] = toTransactions([row()], own)
    expect(tx.direction).toBe('expense')
    expect(tx.amount).toBe(300000)
    expect(tx.date).toBe('2026-09-19')
  })

  it('зачисление на мой счёт — это доход', () => {
    const [tx] = toTransactions([row({ fromAccount: 'EMPLOYER', toAccount: 'MINE1' })], own)
    expect(tx.direction).toBe('income')
  })

  it('оба счёта мои — это внутренний перевод', () => {
    const [tx] = toTransactions([row({ fromAccount: 'MINE1', toAccount: 'MINE2' })], own)
    expect(tx.direction).toBe('internal')
  })

  it('ни один счёт не мой — операция помечается как требующая внимания, а не угадывается', () => {
    const [tx] = toTransactions([row({ fromAccount: 'X', toAccount: 'Y' })], own)
    expect(tx.direction).toBe('unresolved')
  })

  it('проставляет ключ и пустую категорию', () => {
    const [tx] = toTransactions([row()], own)
    expect(tx.key).toMatch(/#1$/)
    expect(tx.categoryId).toBeNull()
  })

  it('сохраняет детали сырыми, без нормализации', () => {
    const [tx] = toTransactions([row()], own)
    expect(tx.details).toBe('Ք: ASK 23 LLC YEREVAN AM 887772')
  })

  it('называет номер строки в сообщении об ошибке', () => {
    expect(() => toTransactions([row(), row({ amount: 'мусор' })], own))
      .toThrow(/Строка 2/)
  })
})

describe('deriveDirections', () => {
  const stored = (over) => ({
    key: 'k', date: '2026-09-19', opType: OP.BETWEEN_OWN, fromAccount: 'A', toAccount: 'C',
    counterparty: '', details: '', comment: '', status: 'Հաստատված', amount: 100000,
    currency: 'AMD', direction: 'expense', categoryId: null, ...over,
  })

  it('пересчитывает направление по переданному списку, а не хранит старое', () => {
    // Перевод A→C сохранён как расход, пока C не был подтверждён своим.
    const [before] = deriveDirections([stored()], ['A', 'B'])
    expect(before.direction).toBe('expense')
    const [after] = deriveDirections([stored()], ['A', 'B', 'C'])
    expect(after.direction).toBe('internal')
  })

  it('даёт те же четыре направления, что и разбор при импорте', () => {
    const list = [
      stored({ key: '1', fromAccount: 'A', toAccount: 'SHOP' }),
      stored({ key: '2', fromAccount: 'EMPLOYER', toAccount: 'A' }),
      stored({ key: '3', fromAccount: 'A', toAccount: 'B' }),
      stored({ key: '4', fromAccount: 'X', toAccount: 'Y', direction: 'income' }),
    ]
    expect(deriveDirections(list, ['A', 'B']).map((tx) => tx.direction))
      .toEqual(['expense', 'income', 'internal', 'unresolved'])
  })

  it('не трогает остальные поля и не меняет исходный массив', () => {
    const original = stored({ categoryId: 'transfers' })
    const [derived] = deriveDirections([original], ['A', 'C'])
    expect(derived).toEqual({ ...original, direction: 'internal' })
    expect(original.direction).toBe('expense')
  })
})
