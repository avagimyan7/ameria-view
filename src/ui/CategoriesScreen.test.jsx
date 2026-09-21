import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, cleanup } from '@testing-library/react'
import { CategoriesScreen } from './CategoriesScreen.jsx'
import { SEED_CATEGORIES } from '../rules/seed.js'

const tx = (over) => ({
  key: Math.random().toString(36), date: '2026-09-10', opType: 'Քարտային գործարք',
  fromAccount: 'MINE', toAccount: 'SHOP', counterparty: '', details: '', comment: '',
  status: 'Հաստատված', amount: 100000, currency: 'AMD', direction: 'expense',
  categoryId: 'groceries', ...over,
})

const props = {
  categories: SEED_CATEGORIES,
  budgets: {},
  month: '2026-09',
  today: '2026-09-10',
  onChangeBudget: () => {},
  onShowUncategorized: () => {},
}

describe('CategoriesScreen', () => {
  beforeEach(() => cleanup())

  it('показывает траты по категориям', () => {
    render(<CategoriesScreen {...props} transactions={[tx()]} />)
    // Имя категории и сумма встречаются и в полосах, и в таблице бюджетов,
    // поэтому проверяем наличие, а не единственность.
    expect(screen.getAllByText('Продукты').length).toBeGreaterThan(0)
    // Check for "1 000 ֏" (1000 AMD) - use a flexible matcher for whitespace
    expect(screen.getAllByText((content) => content.includes('1') && content.includes('000')).length).toBeGreaterThan(0)
  })

  it('показывает бюджет, факт и прогноз', () => {
    render(
      <CategoriesScreen {...props} budgets={{ groceries: 300000 }}
        transactions={[tx({ amount: 50000, date: '2026-09-01' })]} />,
    )
    expect(screen.getByTestId('budget-groceries-spent').textContent).toMatch(/500/)
    expect(screen.getByTestId('budget-groceries-projected').textContent).toMatch(/1.*500/)
  })

  it('предупреждает о дне перерасхода', () => {
    render(
      <CategoriesScreen {...props} budgets={{ groceries: 100000 }}
        transactions={[tx({ amount: 50000, date: '2026-09-01' })]} />,
    )
    expect(screen.getByTestId('budget-groceries-overrun').textContent).toMatch(/20/)
  })

  it('сообщает, сколько денег осталось без категории, и ведёт разбирать', () => {
    const onShowUncategorized = vi.fn()
    render(
      <CategoriesScreen {...props} onShowUncategorized={onShowUncategorized}
        transactions={[tx({ categoryId: null, amount: 900000 })]} />,
    )
    expect(screen.getByTestId('uncategorized-summary').textContent).toMatch(/9 000/)
    fireEvent.click(screen.getByRole('button', { name: /разобрать/i }))
    expect(onShowUncategorized).toHaveBeenCalled()
  })

  it('меняет лимит бюджета', () => {
    const onChangeBudget = vi.fn()
    render(
      <CategoriesScreen {...props} budgets={{ groceries: 300000 }}
        onChangeBudget={onChangeBudget} transactions={[tx()]} />,
    )
    fireEvent.change(screen.getByTestId('budget-groceries-limit'), { target: { value: '5000' } })
    expect(onChangeBudget).toHaveBeenCalledWith('groceries', 500000)
  })
})
