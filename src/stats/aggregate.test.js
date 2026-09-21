import { describe, it, expect } from 'vitest'
import { countable, totals, byMonth, byCategory, byMerchant, uncategorized } from './aggregate.js'

const tx = (over) => ({
  key: Math.random().toString(36), date: '2026-09-19', opType: 'Քարտային գործարք',
  fromAccount: 'MINE', toAccount: 'SHOP', counterparty: '', details: 'Ք: ASK 23 LLC 887772',
  comment: '', status: 'Հաստատված', amount: 100000, currency: 'AMD',
  direction: 'expense', categoryId: 'groceries', ...over,
})

describe('countable', () => {
  it('оставляет только подтверждённые доходы и расходы', () => {
    const list = [
      tx(),
      tx({ direction: 'income' }),
      tx({ direction: 'internal' }),
      tx({ direction: 'unresolved' }),
      tx({ status: 'Մերժված' }),
    ]
    expect(countable(list)).toHaveLength(2)
  })
})

describe('totals', () => {
  it('считает пришло, ушло и чистый результат', () => {
    const list = [tx({ amount: 300000 }), tx({ direction: 'income', amount: 500000 })]
    expect(totals(list)).toEqual({ income: 500000, expense: 300000, net: 200000 })
  })

  it('не учитывает внутренние переводы', () => {
    const list = [tx({ amount: 300000 }), tx({ direction: 'internal', amount: 999999 })]
    expect(totals(list).expense).toBe(300000)
  })
})

describe('byMonth', () => {
  it('группирует по месяцам по возрастанию', () => {
    const list = [
      tx({ date: '2026-09-19', amount: 100000 }),
      tx({ date: '2026-07-01', amount: 200000 }),
      tx({ date: '2026-09-02', direction: 'income', amount: 500000 }),
    ]
    expect(byMonth(list)).toEqual([
      { month: '2026-07', income: 0, expense: 200000, net: -200000 },
      { month: '2026-09', income: 500000, expense: 100000, net: 400000 },
    ])
  })
})

describe('byCategory', () => {
  it('складывает по категориям и сортирует по убыванию суммы', () => {
    const list = [
      tx({ categoryId: 'groceries', amount: 100000 }),
      tx({ categoryId: 'transport', amount: 300000 }),
      tx({ categoryId: 'groceries', amount: 50000 }),
    ]
    expect(byCategory(list, 'expense')).toEqual([
      { categoryId: 'transport', amount: 300000, count: 1 },
      { categoryId: 'groceries', amount: 150000, count: 2 },
    ])
  })

  it('отдельной строкой показывает операции без категории', () => {
    const result = byCategory([tx({ categoryId: null, amount: 70000 })], 'expense')
    expect(result).toEqual([{ categoryId: null, amount: 70000, count: 1 }])
  })
})

describe('byMerchant', () => {
  it('группирует по нормализованному имени', () => {
    const list = [
      tx({ details: 'Ք: TELCELL TRANSPORT YEREVAN AM 93', amount: 10000 }),
      tx({ details: 'Ք: TELCELL TRANSPORT YEREVAN AM 12', amount: 20000 }),
    ]
    expect(byMerchant(list, 'expense')).toEqual([
      { merchant: 'TELCELL TRANSPORT YEREVAN AM', amount: 30000, count: 2 },
    ])
  })
})

describe('uncategorized', () => {
  it('ставит самые крупные суммы наверх — там лежат основные деньги', () => {
    const list = [
      tx({ categoryId: null, amount: 10000 }),
      tx({ categoryId: null, amount: 900000 }),
      tx({ categoryId: 'groceries', amount: 500000 }),
    ]
    expect(uncategorized(list).map((t) => t.amount)).toEqual([900000, 10000])
  })
})

describe('инвариант сходимости', () => {
  const list = [
    tx({ amount: 123456, categoryId: 'groceries' }),
    tx({ amount: 789, categoryId: 'transport' }),
    tx({ amount: 42, categoryId: null }),
    tx({ direction: 'income', amount: 555555, categoryId: 'salary' }),
    tx({ direction: 'internal', amount: 777777 }),
    tx({ status: 'Մերժված', amount: 888888 }),
    tx({ date: '2026-08-15', amount: 31337, categoryId: 'cafe' }),
  ]

  it('сумма по категориям равна сумме расходов', () => {
    const sum = byCategory(list, 'expense').reduce((acc, row) => acc + row.amount, 0)
    expect(sum).toBe(totals(list).expense)
  })

  it('сумма по месяцам равна общим итогам', () => {
    const months = byMonth(list)
    expect(months.reduce((acc, m) => acc + m.expense, 0)).toBe(totals(list).expense)
    expect(months.reduce((acc, m) => acc + m.income, 0)).toBe(totals(list).income)
  })

  it('сумма месячных нетто равна общему нетто', () => {
    const monthlyNetSum = byMonth(list).reduce((acc, m) => acc + m.net, 0)
    expect(monthlyNetSum).toBe(totals(list).net)
  })

  it('общее нетто совпадает с ручными расчётами из фиксчера', () => {
    // Countable: groceries 123456 + transport 789 + null 42 + cafe 31337 = 155624 expense
    //           salary 555555 = income
    // Excluded: internal 777777, rejected 888888
    expect(totals(list)).toEqual({
      income: 555555,
      expense: 155624,
      net: 399931,
    })
  })
})
