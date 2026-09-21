import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, cleanup } from '@testing-library/react'
import { TransactionsScreen } from './TransactionsScreen.jsx'
import { SEED_CATEGORIES } from '../rules/seed.js'

const tx = (over) => ({
  key: 'k1', date: '2026-09-10', opType: 'Քարտային գործարք', fromAccount: 'MINE',
  toAccount: 'SHOP', counterparty: '«ԱՍԿ 23» ՍՊԸ', details: 'Ք: ASK 23 LLC YEREVAN AM 887772',
  comment: '', status: 'Հաստատված', amount: 100000, currency: 'AMD',
  direction: 'expense', categoryId: null, ...over,
})

const noop = () => {}

describe('TransactionsScreen', () => {
  it('показывает операции и их суммы', () => {
    cleanup()
    render(
      <TransactionsScreen transactions={[tx()]} categories={SEED_CATEGORIES}
        onAssign={noop} onCreateRule={noop} />,
    )
    expect(screen.getByText(/ASK 23 LLC/)).toBeTruthy()
    // Check the table rows - the first data row contains the amount
    const rows = screen.getAllByRole('row')
    expect(rows.length).toBeGreaterThanOrEqual(2) // header + at least one data row
    expect(/1 000/.test(rows[1].textContent)).toBeTruthy()
  })

  it('сужает список по поисковой строке', () => {
    cleanup()
    render(
      <TransactionsScreen
        transactions={[tx(), tx({ key: 'k2', details: 'нечто другое', counterparty: '' })]}
        categories={SEED_CATEGORIES} onAssign={noop} onCreateRule={noop} />,
    )
    fireEvent.change(screen.getByPlaceholderText(/поиск/i), { target: { value: 'ASK' } })
    expect(screen.getAllByRole('row')).toHaveLength(2) // заголовок + одна операция
  })

  it('при выборе категории сообщает ключ операции', () => {
    cleanup()
    const onAssign = vi.fn()
    render(
      <TransactionsScreen transactions={[tx()]} categories={SEED_CATEGORIES}
        onAssign={onAssign} onCreateRule={noop} />,
    )
    fireEvent.change(screen.getByTestId('assign-k1'), { target: { value: 'groceries' } })
    expect(onAssign).toHaveBeenCalledWith('k1', 'groceries')
  })

  it('при выборе пустой категории очищает категорию и не предлагает правило', () => {
    cleanup()
    const onAssign = vi.fn()
    render(
      <TransactionsScreen
        transactions={[tx({ categoryId: 'groceries' })]}
        categories={SEED_CATEGORIES}
        onAssign={onAssign} onCreateRule={noop} />,
    )
    // Select the empty category option
    fireEvent.change(screen.getByTestId('assign-k1'), { target: { value: '' } })
    // Verify onAssign was called with empty value
    expect(onAssign).toHaveBeenCalledWith('k1', '')
    // Verify no rule preview panel appears
    expect(screen.queryByText(/затронет/i)).toBe(null)
  })

  it('внутренний перевод не окрашивается как расход', () => {
    cleanup()
    render(
      <TransactionsScreen
        transactions={[
          tx({ direction: 'expense' }),
          tx({ key: 'k2', direction: 'internal' }),
          tx({ key: 'k3', direction: 'unresolved' }),
        ]}
        categories={SEED_CATEGORIES} onAssign={noop} onCreateRule={noop} />,
    )
    // Get the table rows (skip header)
    const rows = screen.getAllByRole('row')
    expect(rows.length).toBeGreaterThanOrEqual(4) // header + 3 data rows

    // Find amount cells and check their classes
    const amountCells = Array.from(document.querySelectorAll('td.num'))
    expect(amountCells.length).toBeGreaterThanOrEqual(3)

    // First row (expense) should have 'expense' class
    expect(amountCells[0].className).toContain('expense')
    expect(amountCells[0].className).not.toContain('muted')

    // Second row (internal) should NOT have 'expense' class, should be 'muted'
    expect(amountCells[1].className).not.toContain('expense')
    expect(amountCells[1].className).toContain('muted')

    // Third row (unresolved) should NOT have 'expense' class, should be 'muted'
    expect(amountCells[2].className).not.toContain('expense')
    expect(amountCells[2].className).toContain('muted')
  })

  it('предлагает создать правило и показывает, скольких операций оно коснётся', () => {
    cleanup()
    const onCreateRule = vi.fn()
    render(
      <TransactionsScreen
        transactions={[
          tx(),
          tx({ key: 'k2', details: 'Ք: ASK 23 LLC YEREVAN AM 190677' }),
          tx({ key: 'k3', details: 'Ք: DIFFERENT MERCHANT YEREVAN AM 999999', amount: 200000 }),
        ]}
        categories={SEED_CATEGORIES} onAssign={noop} onCreateRule={onCreateRule} />,
    )
    fireEvent.change(screen.getByTestId('assign-k1'), { target: { value: 'groceries' } })
    // Should show 1 additional operation (k1 current + k2 match = 2 total, minus 1 current = 1 additional)
    // k3 does not match
    expect(screen.getByText(/затронет ещё 1/i)).toBeTruthy()
    // Also verify the total amount is calculated (100000 + 100000 = 200000 luma = 2000 AMD)
    const previewPanel = screen.getByText(/затронет ещё 1/i).closest('.panel')
    expect(/2\s000\s֏/.test(previewPanel.textContent)).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: /создать правило/i }))
    expect(onCreateRule).toHaveBeenCalledWith({ match: 'ASK 23 LLC YEREVAN AM', category: 'groceries' })
  })
})
