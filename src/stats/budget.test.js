import { describe, it, expect } from 'vitest'
import { daysInMonth, budgetProgress } from './budget.js'

const tx = (over) => ({
  key: Math.random().toString(36), date: '2026-09-10', opType: 'Քարտային գործարք',
  fromAccount: 'MINE', toAccount: 'SHOP', counterparty: '', details: '', comment: '',
  status: 'Հաստատված', amount: 100000, currency: 'AMD', direction: 'expense',
  categoryId: 'groceries', ...over,
})

describe('daysInMonth', () => {
  it('знает длину месяца', () => {
    expect(daysInMonth('2026-09')).toBe(30)
    expect(daysInMonth('2026-02')).toBe(28)
    expect(daysInMonth('2024-02')).toBe(29)
  })
})

describe('budgetProgress', () => {
  const budgets = { groceries: 300000 }

  it('считает потраченное по категории за месяц', () => {
    const list = [tx({ amount: 120000 }), tx({ amount: 30000 })]
    const [row] = budgetProgress(list, budgets, '2026-09', '2026-09-10')
    expect(row.spent).toBe(150000)
    expect(row.limit).toBe(300000)
    expect(row.share).toBeCloseTo(0.5)
  })

  it('не считает чужие месяцы, доходы и внутренние переводы', () => {
    const list = [
      tx({ amount: 120000 }),
      tx({ amount: 999999, date: '2026-08-10' }),
      tx({ amount: 999999, direction: 'income' }),
      tx({ amount: 999999, direction: 'internal' }),
    ]
    const [row] = budgetProgress(list, budgets, '2026-09', '2026-09-10')
    expect(row.spent).toBe(120000)
  })

  it('строит прогноз по текущему темпу', () => {
    const list = [tx({ amount: 50000, date: '2026-09-01' })]
    const [row] = budgetProgress(list, budgets, '2026-09', '2026-09-10')
    expect(row.projectedTotal).toBe(150000)
  })

  it('называет день, когда лимит будет пробит', () => {
    const list = [tx({ amount: 50000, date: '2026-09-01' })]
    const [row] = budgetProgress(list, { groceries: 100000 }, '2026-09', '2026-09-10')
    expect(row.overrunDay).toBe(20)
  })

  it('не пугает перерасходом, если прогноз укладывается в лимит', () => {
    const list = [tx({ amount: 10000, date: '2026-09-01' })]
    const [row] = budgetProgress(list, budgets, '2026-09', '2026-09-10')
    expect(row.overrunDay).toBeNull()
  })

  it('для прошедшего месяца прогноз равен факту', () => {
    const list = [tx({ amount: 250000, date: '2026-08-15' })]
    const [row] = budgetProgress(list, budgets, '2026-08', '2026-09-10')
    expect(row.projectedTotal).toBe(250000)
  })

  it('без трат отдаёт нули и не делит на ноль', () => {
    const [row] = budgetProgress([], budgets, '2026-09', '2026-09-10')
    expect(row).toEqual({
      categoryId: 'groceries', limit: 300000, spent: 0, share: 0,
      projectedTotal: 0, overrunDay: null,
    })
  })

  it('не считает неподтверждённые транзакции', () => {
    const list = [
      tx({ amount: 120000 }),
      tx({ amount: 80000, status: 'Չեղարկված' }),
    ]
    const [row] = budgetProgress(list, budgets, '2026-09', '2026-09-10')
    expect(row.spent).toBe(120000)
  })

  it('не прогнозирует для будущих месяцев', () => {
    const list = [tx({ amount: 150000, date: '2026-08-15' })]
    const [row] = budgetProgress(list, budgets, '2026-10', '2026-09-10')
    expect(row.spent).toBe(0)
    expect(row.projectedTotal).toBe(0)
    expect(row.overrunDay).toBeNull()
  })
})
