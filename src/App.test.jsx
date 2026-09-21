import 'fake-indexeddb/auto'
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react'
import * as pipelineModule from './import/pipeline.js'
import App from './App.jsx'
import { clearTransactions, saveTransactions } from './store/db.js'
import { NO_CATEGORY } from './stats/filter.js'
import { formatMoney } from './ui/format.js'

describe('App import flow', () => {
  beforeEach(async () => {
    await clearTransactions()
    localStorage.clear()
  })

  afterEach(async () => {
    await clearTransactions()
  })

  it('does not show stale report after a failed import', async () => {
    const { container } = render(<App />)

    // Mock importWorkbook to test state clearing behavior
    const importSpy = vi.spyOn(pipelineModule, 'importWorkbook')

    try {
      // First import: mock success
      importSpy.mockReturnValueOnce({
        transactions: [],
        detectedAccounts: [],
        report: {
          rows: 5,
          added: 5,
          duplicates: 0,
          unresolved: 0,
          periodFrom: '2026-09-01',
          periodTo: '2026-09-20'
        }
      })

      const fileInput = container.querySelector('input[type="file"]')
      const file1 = new File([new Uint8Array([1, 2, 3])], 'test1.xlsx')
      fireEvent.change(fileInput, { target: { files: [file1] } })

      // Wait for report to appear
      await waitFor(() => {
        expect(screen.getByText(/Импорт завершён/)).toBeTruthy()
      })

      // Verify success report is shown
      expect(screen.getByText(/Добавлено:/)).toBeTruthy()

      // Second import: mock failure
      importSpy.mockImplementationOnce(() => {
        throw new Error('Некорректный формат файла')
      })

      const file2 = new File([new Uint8Array([5, 6, 7])], 'test2.xlsx')
      fireEvent.change(fileInput, { target: { files: [file2] } })

      // Wait for error to appear
      await waitFor(() => {
        expect(screen.getByText(/Некорректный формат файла/)).toBeTruthy()
      })

      // Verify: old report must be gone, only error shown
      expect(screen.queryByText(/Импорт завершён/)).toBeNull()
      expect(screen.queryByText(/Добавлено:/)).toBeNull()
    } finally {
      importSpy.mockRestore()
    }
  })
})

const uncategorizedTx = (over) => ({
  key: Math.random().toString(36), date: '2026-09-10', opType: 'Քարտային գործարք',
  fromAccount: 'MINE', toAccount: 'SHOP', counterparty: '', details: '', comment: '',
  status: 'Հաստատված', amount: 100000, currency: 'AMD', direction: 'expense',
  categoryId: null, ...over,
})

// Единственная деталь фильтра транзакций, у которой есть и «Все категории», и «Без категории» —
// это фильтр категорий на панели, а не select назначения категории в строке таблицы
// (у него нет опции «Все категории»). Это отличает их надёжно.
function findCategoryFilterSelect() {
  return screen
    .getAllByRole('combobox')
    .find((select) => Array.from(select.options).some((opt) => opt.textContent === 'Все категории'))
}

describe('App transactions preset reset on navigation', () => {
  beforeEach(async () => {
    // Предыдущий тестовый файл-сосед (describe выше) не вызывает cleanup(),
    // поэтому явно очищаем DOM перед собственным рендером — иначе на странице
    // остаются две панели навигации и getByRole находит несколько кнопок.
    cleanup()
    await clearTransactions()
    localStorage.clear()
  })

  afterEach(async () => {
    cleanup()
    await clearTransactions()
  })

  it('применяет пресет «Разобрать», но сбрасывает его при обычной навигации через вкладки', async () => {
    // Одна неразобранная, учитываемая операция — чтобы на экране категорий появилась очередь.
    await saveTransactions([uncategorizedTx({ key: 'uncat-1' })])

    render(<App />)

    // App грузит транзакции из IndexedDB асинхронно и сам переключает экран на «Обзор»,
    // когда данные приходят (см. useEffect в App.jsx). Если кликнуть «Категории» до того,
    // как это доигралось, этот же эффект молча откатит нас обратно на «Обзор». Поэтому
    // сперва дожидаемся, что данные точно загружены, и только потом идём в «Категории».
    await screen.findByTestId('loan-total')

    fireEvent.click(screen.getByRole('button', { name: 'Категории' }))

    const disassembleButton = await screen.findByRole('button', { name: /разобрать/i })
    fireEvent.click(disassembleButton)

    // Пресет «Разобрать» применён: фильтр категории стоит на «Без категории»,
    // индикатор «Только учитываемые операции» виден.
    expect(findCategoryFilterSelect().value).toBe(NO_CATEGORY)
    expect(screen.getByText(/Только учитываемые операции/)).toBeTruthy()

    // Обычная навигация прочь с экрана транзакций и обратно должна сбросить пресет.
    fireEvent.click(screen.getByRole('button', { name: 'Обзор' }))
    fireEvent.click(screen.getByRole('button', { name: 'Транзакции' }))

    expect(findCategoryFilterSelect().value).toBe('')
    expect(screen.queryByText(/Только учитываемые операции/)).toBeNull()
  })
})

describe('App currency switcher', () => {
  beforeEach(async () => {
    cleanup()
    await clearTransactions()
    localStorage.clear()
  })

  afterEach(async () => {
    cleanup()
    await clearTransactions()
  })

  it('не показывается, пока все операции в одной валюте — вся выгрузка владельца сегодня в AMD', async () => {
    await saveTransactions([uncategorizedTx({ key: 'amd-1', categoryId: 'groceries', currency: 'AMD' })])

    render(<App />)
    await screen.findByTestId('total-expense')

    expect(screen.queryByLabelText('Валюта')).toBeNull()
  })

  it('появляется при нескольких валютах и переключает статистику обзора без смешивания сумм', async () => {
    await saveTransactions([
      uncategorizedTx({ key: 'amd-1', categoryId: 'groceries', currency: 'AMD', amount: 100000 }),
      uncategorizedTx({ key: 'usd-1', categoryId: 'groceries', currency: 'USD', amount: 5000 }),
    ])

    render(<App />)
    await screen.findByTestId('total-expense')

    const select = screen.getByLabelText('Валюта')
    // По умолчанию выбрана первая встреченная валюта (AMD) — расход показан в драмах,
    // а не как ошибочная сумма 105000, полученная сложением AMD и USD.
    expect(screen.getByTestId('total-expense').textContent).toBe(formatMoney(100000, 'AMD'))

    fireEvent.change(select, { target: { value: 'USD' } })
    expect(screen.getByTestId('total-expense').textContent).toBe(formatMoney(5000, 'USD'))
  })
})
