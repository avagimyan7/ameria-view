import { describe, it, expect } from 'vitest'
import { currenciesOf, countable, totals, byCategory } from './aggregate.js'
import { budgetProgress } from './budget.js'

const tx = (over) => ({
  key: Math.random().toString(36), date: '2026-09-10', opType: 'Քարտային գործարք',
  fromAccount: 'MINE', toAccount: 'SHOP', counterparty: '', details: '', comment: '',
  status: 'Հաստատված', amount: 100000, currency: 'AMD', direction: 'expense',
  categoryId: 'groceries', ...over,
})

const mixed = [tx({ amount: 300000 }), tx({ amount: 5000, currency: 'USD' })]

describe('валюты', () => {
  it('перечисляет валюты, встреченные в данных', () => {
    expect(currenciesOf(mixed)).toEqual(['AMD', 'USD'])
  })

  it('на одной валюте ничего не требует', () => {
    expect(totals([tx()]).expense).toBe(100000)
  })

  it('отказывается складывать разные валюты без явного выбора', () => {
    expect(() => countable(mixed)).toThrow(/валют/)
    expect(() => totals(mixed)).toThrow(/валют/)
  })

  it('считает по выбранной валюте', () => {
    expect(totals(mixed, 'AMD').expense).toBe(300000)
    expect(totals(mixed, 'USD').expense).toBe(5000)
  })

  it('фильтрует по валюте и в разрезе категорий', () => {
    expect(byCategory(mixed, 'expense', 'USD')).toEqual([
      { categoryId: 'groceries', amount: 5000, count: 1 },
    ])
  })

  it('бюджеты считаются в выбранной валюте', () => {
    const rows = budgetProgress(mixed, { groceries: 10000 }, '2026-09', '2026-09-10', 'USD')
    expect(rows[0].spent).toBe(5000)
  })
})
