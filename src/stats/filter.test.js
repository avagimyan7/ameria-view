import { describe, it, expect } from 'vitest'
import { filterTransactions } from './filter.js'

const tx = (over) => ({
  key: Math.random().toString(36), date: '2026-09-10', opType: 'Քարտային գործարք',
  fromAccount: 'MINE', toAccount: 'SHOP', counterparty: '«ԱՍԿ 23» ՍՊԸ',
  details: 'Ք: ASK 23 LLC YEREVAN AM 887772', comment: '', status: 'Հաստատված',
  amount: 100000, currency: 'AMD', direction: 'expense', categoryId: 'groceries', ...over,
})

describe('filterTransactions', () => {
  it('без фильтров возвращает всё', () => {
    expect(filterTransactions([tx(), tx()], {})).toHaveLength(2)
  })

  it('ищет по деталям, контрагенту и комментарию без учёта регистра', () => {
    const list = [tx(), tx({ details: 'нечто', counterparty: '', comment: 'такси' })]
    expect(filterTransactions(list, { query: 'ask 23' })).toHaveLength(1)
    expect(filterTransactions(list, { query: 'ТАКСИ' })).toHaveLength(1)
  })

  it('отбирает по периоду включительно', () => {
    const list = [tx({ date: '2026-09-01' }), tx({ date: '2026-09-10' }), tx({ date: '2026-09-20' })]
    expect(filterTransactions(list, { from: '2026-09-10', to: '2026-09-20' })).toHaveLength(2)
  })

  it('отбирает по сумме, категории, счёту, типу и направлению', () => {
    const list = [tx({ amount: 50000 }), tx({ amount: 500000, categoryId: 'cafe' })]
    expect(filterTransactions(list, { minAmount: 100000 })).toHaveLength(1)
    expect(filterTransactions(list, { maxAmount: 100000 })).toHaveLength(1)
    expect(filterTransactions(list, { categoryId: 'cafe' })).toHaveLength(1)
    expect(filterTransactions(list, { account: 'MINE' })).toHaveLength(2)
    expect(filterTransactions(list, { direction: 'income' })).toHaveLength(0)
    expect(filterTransactions(list, { opType: 'Քարտային գործարք' })).toHaveLength(2)
  })

  it('различает операции без категории и любые операции', () => {
    const list = [tx(), tx({ categoryId: null })]
    expect(filterTransactions(list, { categoryId: '__none__' })).toHaveLength(1)
  })

  it('соединяет фильтры по И', () => {
    const list = [tx({ amount: 500000 }), tx({ amount: 500000, categoryId: 'cafe' })]
    expect(filterTransactions(list, { minAmount: 100000, categoryId: 'cafe' })).toHaveLength(1)
  })
})
