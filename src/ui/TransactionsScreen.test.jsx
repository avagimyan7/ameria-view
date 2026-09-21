import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, cleanup } from '@testing-library/react'
import { TransactionsScreen } from './TransactionsScreen.jsx'
import { SEED_CATEGORIES } from '../rules/seed.js'
import { NO_CATEGORY } from '../stats/filter.js'

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
    // Карточка операции несёт её сумму.
    expect(/1 000/.test(screen.getByTestId('tx-k1').textContent)).toBeTruthy()
  })

  it('сужает список по поисковой строке', () => {
    cleanup()
    render(
      <TransactionsScreen
        transactions={[tx(), tx({ key: 'k2', details: 'нечто другое', counterparty: '' })]}
        categories={SEED_CATEGORIES} onAssign={noop} onCreateRule={noop} />,
    )
    fireEvent.change(screen.getByPlaceholderText(/поиск/i), { target: { value: 'ASK' } })
    expect(screen.getAllByTestId(/^tx-/)).toHaveLength(1) // осталась одна операция
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
    const amountOf = (key) => screen.getByTestId(`tx-${key}`).querySelector('.tx-amount')

    // Расход — красный и со знаком минус.
    expect(amountOf('k1').className).toContain('expense')
    expect(amountOf('k1').textContent.startsWith('−')).toBe(true)

    // Перевод между своими счетами — нейтральный серый и без знака: это не трата.
    expect(amountOf('k2').className).not.toContain('expense')
    expect(amountOf('k2').className).toContain('transfer')
    expect(amountOf('k2').textContent.startsWith('−')).toBe(false)

    // Неопознанная операция — тоже не расход, приглушённая.
    expect(amountOf('k3').className).not.toContain('expense')
    expect(amountOf('k3').className).toContain('muted')
  })

  it('предлагает создать правило и показывает, скольких операций оно коснётся', () => {
    cleanup()
    const onCreateRule = vi.fn()
    render(
      <TransactionsScreen
        transactions={[
          tx(),
          tx({ key: 'k2', details: 'Ք: ASK 23 LLC YEREVAN AM 190677' }),
          tx({ key: 'k3', details: 'Ք: ASK 23 LLC YEREVAN AM 887773' }),
          tx({ key: 'k4', details: 'Ք: DIFFERENT MERCHANT YEREVAN AM 999999', amount: 200000 }),
        ]}
        categories={SEED_CATEGORIES} onAssign={noop} onCreateRule={onCreateRule} />,
    )
    fireEvent.change(screen.getByTestId('assign-k1'), { target: { value: 'groceries' } })
    // Preview excludes source transaction (k1), counts k2 and k3 (both match ASK 23 LLC), not k4 (DIFFERENT)
    // count = 2 (k2 and k3), amount = 100000 + 100000 = 200000 luma = 2000 AMD
    expect(screen.getByText(/затронет ещё 2 операции на/i)).toBeTruthy()
    const previewPanel = screen.getByText(/затронет ещё 2/i).closest('[data-testid="rule-preview"]')
    expect(/2\s000\s֏/.test(previewPanel.textContent)).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: /создать правило/i }))
    expect(onCreateRule).toHaveBeenCalledWith({
      match: 'ASK 23 LLC YEREVAN AM', category: 'groceries', direction: 'expense',
    })
  })

  it('правило из интерфейса сужено направлением исходной операции — входящий перевод не ловит исходящие', () => {
    // Пример из спеки §6.5: «Անձնական փոխանցում» входящий и исходящий — разные по смыслу вещи.
    cleanup()
    const onCreateRule = vi.fn()
    const transfer = (over) => tx({
      opType: 'Փոխանցում քարտին', counterparty: '', details: 'Անձնական փոխանցում', ...over,
    })
    render(
      <TransactionsScreen
        transactions={[
          transfer({ key: 'in1', direction: 'income', amount: 100000 }),
          transfer({ key: 'in2', direction: 'income', amount: 200000 }),
          transfer({ key: 'out1', direction: 'expense', amount: 500000 }),
          transfer({ key: 'out2', direction: 'expense', amount: 700000 }),
        ]}
        categories={SEED_CATEGORIES} onAssign={noop} onCreateRule={onCreateRule} />,
    )
    fireEvent.change(screen.getByTestId('assign-in1'), { target: { value: 'salary' } })

    // Превью описывает именно то правило, которое будет создано: только входящие.
    const previewPanel = screen.getByText(/затронет ещё/i).closest('[data-testid="rule-preview"]')
    expect(previewPanel.textContent).toMatch(/затронет ещё 1 операцию на/)
    expect(previewPanel.textContent).toMatch(/на 2\s000\s֏/)
    expect(previewPanel.textContent).toMatch(/только доходы/)

    fireEvent.click(screen.getByRole('button', { name: /создать правило/i }))
    expect(onCreateRule).toHaveBeenCalledWith({
      match: 'ԱՆՁՆԱԿԱՆ ՓՈԽԱՆՑՈՒՄ', category: 'salary', direction: 'income',
    })
    // Служебный ключ исходной операции в сохранённое правило не попадает.
    expect(onCreateRule.mock.calls[0][0]).not.toHaveProperty('sourceKey')
  })

  it('если все совпадения правила лежат в одной (не AMD) валюте, сумма подписана этой валютой', () => {
    cleanup()
    render(
      <TransactionsScreen
        transactions={[
          tx({ currency: 'USD', amount: 2000 }),
          tx({ key: 'k2', details: 'Ք: ASK 23 LLC YEREVAN AM 190677', currency: 'USD', amount: 3000 }),
        ]}
        categories={SEED_CATEGORIES} onAssign={noop} onCreateRule={noop} />,
    )
    fireEvent.change(screen.getByTestId('assign-k1'), { target: { value: 'groceries' } })
    const previewPanel = screen.getByText(/затронет ещё 1/i).closest('[data-testid="rule-preview"]')
    expect(previewPanel.textContent).toContain('30 USD')
    expect(previewPanel.textContent).not.toContain('֏')
  })

  it('если совпадения правила лежат в разных валютах, общую сумму не показывает', () => {
    // Банк не даёт курсов, поэтому сумма совпадений текстового правила в разных
    // валютах не может быть показана одним числом под одним знаком — это была бы
    // ровно та тихая ложь (драмы и доллары под ֏), ради которой существует задача.
    cleanup()
    render(
      <TransactionsScreen
        transactions={[
          tx(),
          tx({ key: 'k2', details: 'Ք: ASK 23 LLC YEREVAN AM 190677' }),
          tx({ key: 'k3', details: 'Ք: ASK 23 LLC YEREVAN AM 887773', currency: 'USD', amount: 5000 }),
        ]}
        categories={SEED_CATEGORIES} onAssign={noop} onCreateRule={noop} />,
    )
    fireEvent.change(screen.getByTestId('assign-k1'), { target: { value: 'groceries' } })
    // count = 2: k2 (AMD) и k3 (USD) оба совпадают текстом, k1 исключён как источник.
    const previewPanel = screen.getByText(/затронет ещё 2/i).closest('[data-testid="rule-preview"]')
    expect(previewPanel.textContent).toMatch(/нескольких валютах/)
    expect(previewPanel.textContent).not.toContain('֏')
    expect(previewPanel.textContent).not.toContain('USD')
  })

  it('подписывает сумму операции её собственной валютой, а не всегда драмом', () => {
    cleanup()
    render(
      <TransactionsScreen
        transactions={[tx({ currency: 'USD', amount: 5000 })]}
        categories={SEED_CATEGORIES} onAssign={noop} onCreateRule={noop} />,
    )
    const card = screen.getByTestId('tx-k1')
    expect(card.textContent).toContain('50 USD')
    expect(card.textContent).not.toContain('֏')
  })

  it('категория фильтра контролируется и отражает начальные фильтры', () => {
    cleanup()
    render(
      <TransactionsScreen
        transactions={[tx({ categoryId: null }), tx({ key: 'k2', categoryId: 'groceries' })]}
        categories={SEED_CATEGORIES}
        onAssign={noop}
        onCreateRule={noop}
        initialFilters={{ categoryId: NO_CATEGORY }}
      />,
    )
    // Find the category filter select
    const selects = screen.getAllByRole('combobox')
    const categorySelect = selects.find((sel) => {
      const options = Array.from(sel.options)
      return options.some((opt) => opt.textContent.includes('Без категории'))
    })
    // The select value should be set to NO_CATEGORY
    expect(categorySelect.value).toBe(NO_CATEGORY)
  })
})
