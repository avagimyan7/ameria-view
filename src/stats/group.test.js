import { describe, it, expect } from 'vitest'
import { groupByDay } from './group.js'

const tx = (over) => ({
  key: Math.random().toString(36), date: '2026-09-19', status: 'Հաստատված',
  amount: 100000, currency: 'AMD', direction: 'expense', ...over,
})

describe('groupByDay', () => {
  it('собирает операции по дням, сохраняя порядок списка', () => {
    const list = [
      tx({ key: 'a', date: '2026-09-19' }),
      tx({ key: 'b', date: '2026-09-19' }),
      tx({ key: 'c', date: '2026-09-18' }),
    ]
    const groups = groupByDay(list)
    expect(groups.map((g) => g.date)).toEqual(['2026-09-19', '2026-09-18'])
    expect(groups[0].items.map((t) => t.key)).toEqual(['a', 'b'])
  })

  it('считает за день отдельно пришедшее и ушедшее', () => {
    const groups = groupByDay([
      tx({ direction: 'income', amount: 500000 }),
      tx({ direction: 'expense', amount: 30000 }),
      tx({ direction: 'expense', amount: 20000 }),
    ])
    expect(groups[0]).toMatchObject({ income: 500000, expense: 50000, currency: 'AMD' })
  })

  it('переводы между своими счетами и неподтверждённые операции в итог дня не входят', () => {
    const groups = groupByDay([
      tx({ direction: 'internal', amount: 900000 }),
      tx({ direction: 'expense', amount: 10000, status: 'Մշակման մեջ' }),
      tx({ direction: 'expense', amount: 30000 }),
    ])
    expect(groups[0]).toMatchObject({ income: 0, expense: 30000 })
  })

  it('день с разными валютами итога не получает: складывать их нельзя', () => {
    const groups = groupByDay([
      tx({ currency: 'AMD', amount: 100000 }),
      tx({ currency: 'USD', amount: 500 }),
    ])
    expect(groups[0].currency).toBeNull()
  })

  it('если один день встречается в списке дважды (сортировка по сумме), групп тоже две', () => {
    const groups = groupByDay([
      tx({ date: '2026-09-19' }), tx({ date: '2026-09-18' }), tx({ date: '2026-09-19' }),
    ])
    expect(groups.map((g) => g.date)).toEqual(['2026-09-19', '2026-09-18', '2026-09-19'])
  })
})
