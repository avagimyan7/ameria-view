import { describe, it, expect } from 'vitest'
import { toTransactions } from './transactions.js'
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
