import { describe, it, expect } from 'vitest'
import { filterTransactions, NO_CATEGORY } from './filter.js'
import { uncategorized } from './aggregate.js'

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

  it('countableOnly исключает внутренние переводы, нерешённые и неподтверждённые операции', () => {
    const list = [
      tx({ direction: 'expense' }), // Approved, expense - counted
      tx({ direction: 'income' }), // Approved, income - counted
      tx({ direction: 'internal' }), // Internal - NOT counted
      tx({ direction: 'unresolved' }), // Unresolved - NOT counted
      tx({ status: 'Պենդինգ' }), // Not approved - NOT counted
    ]
    expect(filterTransactions(list, { countableOnly: true })).toHaveLength(2)
  })

  it('очередь разбора (uncategorized) и фильтр «Разобрать» (categoryId + countableOnly) описывают одно и то же множество', () => {
    const list = [
      // Без категории и учитываемые — должны попасть в обе очереди.
      tx({ direction: 'expense', categoryId: null }),
      tx({ direction: 'income', categoryId: null }),
      // Разобранные — не должны попасть ни туда, ни туда.
      tx({ direction: 'expense', categoryId: 'groceries' }),
      tx({ direction: 'income', categoryId: 'salary' }),
      // Внутренний перевод без категории — не учитывается, несмотря на отсутствие категории.
      tx({ direction: 'internal', categoryId: null }),
      // Операция «требует внимания» без категории — тоже не учитывается.
      tx({ direction: 'unresolved', categoryId: null }),
      // Неподтверждённая операция без категории — тоже не учитывается.
      tx({ direction: 'expense', categoryId: null, status: 'Պենդինգ' }),
    ]

    const queue = uncategorized(list)
    const preset = filterTransactions(list, { categoryId: NO_CATEGORY, countableOnly: true })

    expect(queue).toHaveLength(2)
    expect(preset).toHaveLength(2)
    expect(preset.length).toBe(queue.length)
  })
})
