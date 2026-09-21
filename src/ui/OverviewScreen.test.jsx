import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import { OverviewScreen } from './OverviewScreen.jsx'
import { SEED_CATEGORIES } from '../rules/seed.js'

const tx = (over) => ({
  key: Math.random().toString(36), date: '2026-09-10', opType: 'Քարտային գործարք',
  fromAccount: 'MINE', toAccount: 'SHOP', counterparty: '', details: '', comment: '',
  status: 'Հաստատված', amount: 100000, currency: 'AMD', direction: 'expense',
  categoryId: 'groceries', ...over,
})

describe('OverviewScreen', () => {
  beforeEach(() => cleanup())

  it('на пустых данных зовёт импортировать выгрузку', () => {
    render(<OverviewScreen transactions={[]} categories={SEED_CATEGORIES} />)
    expect(screen.getByText(/нет данных/i)).toBeTruthy()
  })

  it('показывает пришло, ушло и чистый результат', () => {
    const list = [tx({ amount: 300000 }), tx({ direction: 'income', amount: 500000, categoryId: 'salary' })]
    render(<OverviewScreen transactions={list} categories={SEED_CATEGORIES} />)
    expect(screen.getByTestId('total-income').textContent).toMatch(/5 000/)
    expect(screen.getByTestId('total-expense').textContent).toMatch(/3 000/)
    expect(screen.getByTestId('total-net').textContent).toMatch(/2 000/)
  })

  it('отдельной строкой показывает комиссии банка', () => {
    const list = [tx({ categoryId: 'fees', amount: 900 }), tx({ amount: 300000 })]
    render(<OverviewScreen transactions={list} categories={SEED_CATEGORIES} />)
    expect(screen.getByTestId('fees-total').textContent).toMatch(/9/)
  })

  it('называет категории человеческими именами', () => {
    render(<OverviewScreen transactions={[tx()]} categories={SEED_CATEGORIES} />)
    expect(screen.getByText('Продукты')).toBeTruthy()
  })
})
