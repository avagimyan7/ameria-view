import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, cleanup } from '@testing-library/react'
import { CategoriesScreen } from './CategoriesScreen.jsx'
import { SEED_CATEGORIES } from '../rules/seed.js'
import { formatAmd } from './format.js'

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
    // Check for exactly "1 000 ֏" in the bars (100000 luma)
    const expected = formatAmd(100000)
    expect(screen.getByRole('table').textContent).toContain(expected)
  })

  it('показывает бюджет, факт и прогноз', () => {
    render(
      <CategoriesScreen {...props} budgets={{ groceries: 300000 }}
        transactions={[tx({ amount: 50000, date: '2026-09-01' })]} />,
    )
    // Spent should show exactly what was spent (50000 luma = 500 AMD)
    expect(screen.getByTestId('budget-groceries-spent').textContent).toBe(formatAmd(50000))
    // Projected should show the extrapolated total based on spending rate
    // With 10 days elapsed (Sept 1-10) and 50000 luma spent, daily rate = 5000
    // Full month (30 days) would be 150000 luma = 1500 AMD
    const projectedText = screen.getByTestId('budget-groceries-projected').textContent
    expect(projectedText).toBe(formatAmd(150000))
  })

  it('показывает траты даже категориям без лимита', () => {
    render(
      <CategoriesScreen {...props} budgets={{}}
        transactions={[tx({ categoryId: 'transport', amount: 145770 })]} />,
    )
    // Transport category has no limit set, but should still show spending
    expect(screen.getByTestId('budget-transport-spent').textContent).toBe(formatAmd(145770))
  })

  it('запрещает отрицательные лимиты', () => {
    const onChangeBudget = vi.fn()
    render(
      <CategoriesScreen {...props} onChangeBudget={onChangeBudget} transactions={[tx()]} />,
    )
    fireEvent.change(screen.getByTestId('budget-groceries-limit'), { target: { value: '-500' } })
    // Should clamp to 0
    expect(onChangeBudget).toHaveBeenCalledWith('groceries', 0)
  })

  it('предупреждает о дне перерасхода когда лимит не превышен', () => {
    render(
      <CategoriesScreen {...props} budgets={{ groceries: 100000 }}
        transactions={[tx({ amount: 50000, date: '2026-09-01' })]} />,
    )
    // Spending is under limit, so should show forecast day
    expect(screen.getByTestId('budget-groceries-overrun').textContent).toMatch(/20/)
  })

  it('показывает превышен когда лимит уже нарушен', () => {
    render(
      <CategoriesScreen {...props} budgets={{ groceries: 100000 }}
        transactions={[tx({ amount: 150000, date: '2026-09-01' })]} />,
    )
    // Spending exceeds limit, should show "превышен"
    expect(screen.getByTestId('budget-groceries-overrun').textContent).toBe('превышен')
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

  it('называет месяц, за который построены полосы категорий', () => {
    render(<CategoriesScreen {...props} month="2026-08" transactions={[tx({ date: '2026-08-10' })]} />)
    expect(screen.getByTestId('categories-heading').textContent).toMatch(/август 2026/)
  })

  it('честно называет масштаб очереди «Без категории»: весь период, доходы и расходы вместе', () => {
    render(
      <CategoriesScreen {...props} month="2026-09"
        transactions={[
          // Прошлый месяц — вне полос за сентябрь, но в очереди разбора.
          tx({ categoryId: null, date: '2026-08-05', amount: 100000 }),
          // Доход — тоже в очереди.
          tx({ categoryId: null, direction: 'income', date: '2026-09-02', amount: 200000 }),
        ]} />,
    )
    const summary = screen.getByTestId('uncategorized-summary').textContent
    expect(summary).toMatch(/весь период/)
    expect(summary).toMatch(/доходы и расходы/)
    // Очередь считает всё время, а не только выбранный месяц — это намеренно.
    expect(summary).toMatch(/(^|\D)2 операц/)
  })

  it('счет неразобранных не включает внутренние переводы', () => {
    render(
      <CategoriesScreen {...props}
        transactions={[
          tx({ categoryId: null, direction: 'expense', amount: 100000 }),
          tx({ categoryId: null, direction: 'internal', amount: 500000 }),
        ]} />,
    )
    const summary = screen.getByTestId('uncategorized-summary').textContent
    expect(summary).toMatch(/1 операций/)
  })
})
