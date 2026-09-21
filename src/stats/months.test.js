import { describe, it, expect } from 'vitest'
import { neighbours, chartWindow, serviceShare } from './months.js'

const m = (...list) => list.map((month) => ({ month, income: 0, expense: 0, net: 0 }))

describe('neighbours', () => {
  it('даёт предыдущий и следующий месяц, в которых есть данные', () => {
    const months = m('2026-07', '2026-08', '2026-09')
    expect(neighbours(months, '2026-08')).toEqual({ prev: '2026-07', next: '2026-09' })
  })

  it('на краях соседа нет', () => {
    const months = m('2026-07', '2026-08')
    expect(neighbours(months, '2026-07')).toEqual({ prev: null, next: '2026-08' })
    expect(neighbours(months, '2026-08')).toEqual({ prev: '2026-07', next: null })
  })

  it('перескакивает через месяцы без операций', () => {
    // Май пустой — переключатель идёт с июня сразу на апрель, а не в пустоту.
    const months = m('2026-04', '2026-06')
    expect(neighbours(months, '2026-06').prev).toBe('2026-04')
  })

  it('для неизвестного месяца соседей нет', () => {
    expect(neighbours(m('2026-07'), '2026-01')).toEqual({ prev: null, next: null })
  })
})

describe('chartWindow', () => {
  const year = m('2026-01', '2026-02', '2026-03', '2026-04', '2026-05', '2026-06', '2026-07', '2026-08')

  it('показывает последние месяцы, если выбран один из них', () => {
    expect(chartWindow(year, '2026-08', 3).map((row) => row.month)).toEqual(['2026-06', '2026-07', '2026-08'])
    expect(chartWindow(year, '2026-07', 3).map((row) => row.month)).toEqual(['2026-06', '2026-07', '2026-08'])
  })

  it('сдвигается назад, чтобы выбранный давний месяц остался на графике', () => {
    expect(chartWindow(year, '2026-02', 3).map((row) => row.month)).toEqual(['2026-01', '2026-02', '2026-03'])
  })

  it('короткую историю отдаёт целиком', () => {
    expect(chartWindow(m('2026-07', '2026-08'), '2026-08', 6)).toHaveLength(2)
  })
})

describe('serviceShare', () => {
  it('считает долю комиссий и кредита во всех расходах', () => {
    const rows = [
      { categoryId: 'groceries', amount: 600 },
      { categoryId: 'fees', amount: 100 },
      { categoryId: 'loan_principal', amount: 200 },
      { categoryId: 'loan_interest', amount: 100 },
    ]
    expect(serviceShare(rows)).toBeCloseTo(0.4)
  })

  it('без расходов доли нет', () => {
    expect(serviceShare([])).toBeNull()
  })

  it('без комиссий и кредита доля нулевая', () => {
    expect(serviceShare([{ categoryId: 'groceries', amount: 500 }])).toBe(0)
  })
})
