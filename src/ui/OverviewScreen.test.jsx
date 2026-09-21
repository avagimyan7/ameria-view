import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen, cleanup, fireEvent } from '@testing-library/react'
import { OverviewScreen } from './OverviewScreen.jsx'
import { SEED_CATEGORIES } from '../rules/seed.js'
import { formatAmd } from './format.js'

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
    expect(screen.getByTestId('fees-total').textContent).toBe(formatAmd(900))
  })

  it('называет категории человеческими именами', () => {
    render(<OverviewScreen transactions={[tx()]} categories={SEED_CATEGORIES} />)
    expect(screen.getByText('Продукты')).toBeTruthy()
  })

  it('показывает сумму кредита (тело + проценты)', () => {
    const list = [
      tx({ categoryId: 'loan_principal', amount: 500000 }),
      tx({ categoryId: 'loan_interest', amount: 50000 }),
    ]
    render(<OverviewScreen transactions={list} categories={SEED_CATEGORIES} />)
    expect(screen.getByTestId('loan-total').textContent).toBe(formatAmd(550000))
  })

  it('выбор месяца отменяется, если данные не содержат его', () => {
    // Render with September data
    const septemberTx = [tx({ date: '2026-09-10', amount: 100000 })]
    const { rerender } = render(
      <OverviewScreen transactions={septemberTx} categories={SEED_CATEGORIES} />,
    )
    // Heading should show сентябрь 2026
    expect(screen.getByRole('heading', { level: 2 }).textContent).toMatch(/сентябрь/)

    // Click the month bar to select it
    fireEvent.click(screen.getByText('сен'))

    // Verify it's selected (should still show сентябрь)
    expect(screen.getByRole('heading', { level: 2 }).textContent).toMatch(/сентябрь/)

    // Re-render with August data only
    const augustTx = [tx({ date: '2026-08-15', amount: 100000 })]
    rerender(<OverviewScreen transactions={augustTx} categories={SEED_CATEGORIES} />)

    // Heading should now show август (latest month that exists), not сентябрь
    expect(screen.getByRole('heading', { level: 2 }).textContent).toMatch(/август/)
    // Totals should show data from август (not zeros)
    expect(screen.getByTestId('total-expense').textContent).toBe(formatAmd(100000))
  })
})
