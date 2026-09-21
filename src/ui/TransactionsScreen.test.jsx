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

  it('предлагает создать правило и показывает, скольких операций оно коснётся', () => {
    cleanup()
    const onCreateRule = vi.fn()
    render(
      <TransactionsScreen
        transactions={[tx(), tx({ key: 'k2', details: 'Ք: ASK 23 LLC YEREVAN AM 190677' })]}
        categories={SEED_CATEGORIES} onAssign={noop} onCreateRule={onCreateRule} />,
    )
    fireEvent.change(screen.getByTestId('assign-k1'), { target: { value: 'groceries' } })
    expect(screen.getByText(/затронет ещё 2/i)).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: /создать правило/i }))
    expect(onCreateRule).toHaveBeenCalledWith({ match: 'ASK 23 LLC YEREVAN AM', category: 'groceries' })
  })
})
