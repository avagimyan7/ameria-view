import 'fake-indexeddb/auto'
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react'
import * as pipelineModule from './import/pipeline.js'
import App from './App.jsx'
import { clearTransactions, saveTransactions } from './store/db.js'
import { NO_CATEGORY } from './stats/filter.js'
import { formatMoney } from './ui/format.js'
import { buildWorkbook } from '../test/fixtures/buildWorkbook.js'
import { HEADERS, OP } from './domain/constants.js'
import { defaultSettings, saveSettings, loadSettings } from './store/settings.js'

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

  it('очередь «Разобрать» следует за переключением валюты, а не застревает на прежней', async () => {
    await saveTransactions([
      uncategorizedTx({ key: 'amd-1', currency: 'AMD', amount: 100000, details: 'AMD MERCHANT' }),
      uncategorizedTx({ key: 'usd-1', currency: 'USD', amount: 5000, details: 'USD MERCHANT' }),
    ])

    render(<App />)
    await screen.findByTestId('total-expense')

    fireEvent.click(screen.getByRole('button', { name: 'Категории' }))
    const disassembleButton = await screen.findByRole('button', { name: /разобрать/i })
    fireEvent.click(disassembleButton)

    // Очередь открылась в валюте, активной на момент клика (AMD — первая встреченная).
    expect(screen.getByText('AMD MERCHANT')).toBeTruthy()
    expect(screen.queryByText('USD MERCHANT')).toBeNull()

    // Переключаем валюту приложения, оставаясь на экране очереди — не заходя в «Разобрать» заново.
    fireEvent.change(screen.getByLabelText('Валюта'), { target: { value: 'USD' } })

    // Очередь обязана тут же показать неразобранное в USD, а не застрять на AMD.
    expect(screen.queryByText('AMD MERCHANT')).toBeNull()
    expect(screen.getByText('USD MERCHANT')).toBeTruthy()
  })
})

describe('App currency selection does not outlive its data', () => {
  beforeEach(async () => {
    cleanup()
    await clearTransactions()
    localStorage.clear()
  })

  afterEach(async () => {
    cleanup()
    await clearTransactions()
  })

  it('если выбранная валюта пропадает из новых данных, активная валюта откатывается вместо того, чтобы застыть на несуществующей', async () => {
    const { container } = render(<App />)
    const importSpy = vi.spyOn(pipelineModule, 'importWorkbook')

    try {
      importSpy.mockReturnValueOnce({
        transactions: [
          uncategorizedTx({ key: 'amd-1', categoryId: 'groceries', currency: 'AMD', amount: 100000 }),
          uncategorizedTx({ key: 'usd-1', categoryId: 'groceries', currency: 'USD', amount: 5000 }),
        ],
        detectedAccounts: [],
        report: {
          rows: 2, added: 2, duplicates: 0, unresolved: 0,
          periodFrom: '2026-09-01', periodTo: '2026-09-20',
        },
      })

      const fileInput = container.querySelector('input[type="file"]')
      fireEvent.change(fileInput, { target: { files: [new File([new Uint8Array([1, 2, 3])], 'a.xlsx')] } })
      // Оба отчёта об импорте говорят «Импорт завершён» — ждать нужно чего-то,
      // что различает первый отчёт от второго, иначе waitFor может решить, что
      // готово, по ещё не сброшенному прежнему отчёту.
      await waitFor(() => expect(screen.getByText('Строк в файле: 2')).toBeTruthy())

      fireEvent.change(screen.getByLabelText('Валюта'), { target: { value: 'USD' } })
      expect(screen.getByLabelText('Валюта').value).toBe('USD')

      // Следующий импорт приносит уже только AMD — валюта, на которую переключились, исчезла.
      importSpy.mockReturnValueOnce({
        transactions: [
          uncategorizedTx({ key: 'amd-2', categoryId: 'groceries', currency: 'AMD', amount: 200000 }),
        ],
        detectedAccounts: [],
        report: {
          rows: 1, added: 1, duplicates: 0, unresolved: 0,
          periodFrom: '2026-09-01', periodTo: '2026-09-20',
        },
      })
      fireEvent.change(fileInput, { target: { files: [new File([new Uint8Array([4, 5, 6])], 'b.xlsx')] } })
      await waitFor(() => expect(screen.getByText('Строк в файле: 1')).toBeTruthy())

      // Единственная оставшаяся валюта — AMD, переключатель обязан пропасть, а не
      // продолжать показывать выбор несуществующего USD.
      expect(screen.queryByLabelText('Валюта')).toBeNull()

      // И статистика обязана считаться в AMD, а не молчать нулями из-за того, что
      // внутри всё ещё «выбран USD» (в духе фантомного месяца из Task 18).
      fireEvent.click(screen.getByRole('button', { name: 'Обзор' }))
      expect(screen.getByTestId('total-expense').textContent).toBe(formatMoney(200000, 'AMD'))
    } finally {
      importSpy.mockRestore()
    }
  })
})

const HEADER_ROW = [
  HEADERS.date, HEADERS.docNo, HEADERS.opType, HEADERS.fromAccount, HEADERS.toAccount,
  HEADERS.counterparty, HEADERS.details, HEADERS.status, HEADERS.comment, HEADERS.amount,
  HEADERS.currency,
]
const sheetRow = ({ date = '19-09-2026', opType, from, to, details, amount, status = 'Հաստատված' }) =>
  [date, '31', opType, from, to, '', details, status, '', amount, 'AMD']

describe('App: направление производно от текущего списка своих счетов', () => {
  const A = '1570000000000001'
  const B = '1570000000000002'
  const C = '1570000000000003'

  beforeEach(async () => {
    cleanup()
    await clearTransactions()
    localStorage.clear()
  })

  afterEach(async () => {
    cleanup()
    await clearTransactions()
  })

  it('подтверждение нового счёта C делает давний перевод A→C внутренним без повторного импорта', async () => {
    // Счета A и B уже подтверждены; C владелец завёл позже.
    saveSettings({ ...defaultSettings(), ownAccounts: [A, B] })
    const importSpy = vi.spyOn(pipelineModule, 'importWorkbook')

    try {
      const { container } = render(<App />)
      const fileInput = container.querySelector('input[type="file"]')
      await waitFor(() => expect(fileInput.disabled).toBe(false))

      const bytes = buildWorkbook([
        HEADER_ROW,
        // Банк сам пометил перевод как «между моими счетами».
        sheetRow({ opType: OP.BETWEEN_OWN, from: A, to: C, details: 'MOVE TO C', amount: '50000.0' }),
        sheetRow({ opType: OP.CARD, from: A, to: 'SHOP', details: 'Ք: SHOP LLC 887772', amount: '1000.0' }),
      ])
      fireEvent.change(fileInput, { target: { files: [new File([bytes], 'export.xlsx')] } })
      await waitFor(() => expect(screen.getByText('Строк в файле: 2')).toBeTruthy())

      // Предложен только новый счёт C — A и B уже подтверждены.
      const prompt = screen.getByTestId('accounts-prompt')
      expect(prompt.textContent).toContain('1570…0003')
      expect(prompt.textContent).not.toContain('1570…0001')

      // До подтверждения C перевод A→C — расход, а не внутренний.
      fireEvent.click(screen.getByRole('button', { name: 'Обзор' }))
      expect(screen.getByTestId('total-expense').textContent).toBe(formatMoney(5100000, 'AMD'))

      fireEvent.click(screen.getByRole('button', { name: 'Импорт' }))
      fireEvent.click(screen.getByRole('button', { name: /подтвердить счета/i }))

      // Подтверждение добавило C к списку, а не заменило его.
      expect(loadSettings().ownAccounts).toEqual([A, B, C])

      // Без повторного импорта перевод стал внутренним и ушёл из расходов.
      fireEvent.click(screen.getByRole('button', { name: 'Обзор' }))
      expect(screen.getByTestId('total-expense').textContent).toBe(formatMoney(100000, 'AMD'))
      expect(importSpy).toHaveBeenCalledTimes(1)

      fireEvent.click(screen.getByRole('button', { name: 'Транзакции' }))
      fireEvent.change(
        screen.getAllByRole('combobox').find((select) =>
          Array.from(select.options).some((option) => option.value === 'internal')),
        { target: { value: 'internal' } },
      )
      expect(screen.getByText('MOVE TO C')).toBeTruthy()
    } finally {
      importSpy.mockRestore()
    }
  })

  it('пока ничего не подтверждено, при загрузке своими считаются найденные автоматически, а не «никакие»', async () => {
    // Task 16: пустой подтверждённый список — не утверждение «своих счетов нет».
    await saveTransactions([
      uncategorizedTx({ key: 'card', fromAccount: A, toAccount: 'SHOP', amount: 100000, direction: 'unresolved' }),
      uncategorizedTx({
        key: 'move', opType: OP.BETWEEN_OWN, fromAccount: A, toAccount: B, amount: 5000000,
        direction: 'unresolved',
      }),
    ])
    render(<App />)
    // Расход — только карточная покупка: перевод A→B внутренний, а не расход и не «неопознанный».
    expect((await screen.findByTestId('total-expense')).textContent).toBe(formatMoney(100000, 'AMD'))
    expect(screen.getByTestId('total-income').textContent).toBe(formatMoney(0, 'AMD'))
  })

  it('отказ от предложенного счёта оставляет список своих счетов как был', async () => {
    saveSettings({ ...defaultSettings(), ownAccounts: [A] })
    const { container } = render(<App />)
    const fileInput = container.querySelector('input[type="file"]')
    await waitFor(() => expect(fileInput.disabled).toBe(false))

    const bytes = buildWorkbook([
      HEADER_ROW,
      sheetRow({ opType: OP.BETWEEN_OWN, from: A, to: B, details: 'MOVE TO B', amount: '100.0' }),
    ])
    fireEvent.change(fileInput, { target: { files: [new File([bytes], 'export.xlsx')] } })
    await screen.findByTestId('accounts-prompt')

    fireEvent.click(screen.getByRole('button', { name: /не мои/i }))
    expect(screen.queryByTestId('accounts-prompt')).toBeNull()
    expect(loadSettings().ownAccounts).toEqual([A])
  })
})
