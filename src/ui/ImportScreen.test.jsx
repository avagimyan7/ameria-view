import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react'
import { ImportScreen } from './ImportScreen.jsx'

describe('ImportScreen', () => {
  it('без отчёта объясняет, где взять файл', () => {
    render(<ImportScreen onImport={() => {}} onConfirmAccounts={() => {}} />)
    expect(screen.getByText(/myameria\.am\/history/i)).toBeTruthy()
  })

  it('показывает отчёт об импорте', () => {
    render(
      <ImportScreen
        onImport={() => {}}
        onConfirmAccounts={() => {}}
        report={{ rows: 254, added: 254, duplicates: 0, unresolved: 0,
          periodFrom: '2026-07-22', periodTo: '2026-09-20' }}
      />,
    )
    expect(screen.getByText(/добавлено: 254/i)).toBeTruthy()
    expect(screen.getByText(/дублей: 0/i)).toBeTruthy()
    expect(screen.getByText(/22\.07\.2026/)).toBeTruthy()
  })

  it('предупреждает об операциях, требующих внимания', () => {
    render(
      <ImportScreen
        onImport={() => {}}
        onConfirmAccounts={() => {}}
        report={{ rows: 10, added: 10, duplicates: 0, unresolved: 3,
          periodFrom: '2026-09-01', periodTo: '2026-09-10' }}
      />,
    )
    expect(screen.getByText(/требуют внимания: 3/i)).toBeTruthy()
  })

  it('даёт подтвердить найденные счета', () => {
    const onConfirmAccounts = vi.fn()
    render(
      <ImportScreen
        onImport={() => {}}
        onConfirmAccounts={onConfirmAccounts}
        detectedAccounts={['1570000000000001', '1570000000000002']}
        ownAccounts={[]}
      />,
    )
    fireEvent.click(screen.getByRole('button', { name: /подтвердить счета/i }))
    expect(onConfirmAccounts).toHaveBeenCalledWith([
      '1570000000000001',
      '1570000000000002',
    ])
  })

  it('предлагает только новые счета — те, что ещё не подтверждены', () => {
    const onConfirmAccounts = vi.fn()
    const { container } = render(
      <ImportScreen
        onImport={() => {}}
        onConfirmAccounts={onConfirmAccounts}
        detectedAccounts={['1570000000000001', '1570000000000002', '1570000000000003']}
        ownAccounts={['1570000000000001', '1570000000000002']}
      />,
    )
    const prompt = within(container).getByTestId('accounts-prompt')
    expect(prompt.textContent).toContain('1570…0003')
    expect(prompt.textContent).not.toContain('1570…0001')
    expect(prompt.textContent).not.toContain('1570…0002')
    fireEvent.click(within(prompt).getByRole('button', { name: /подтвердить счета/i }))
    expect(onConfirmAccounts).toHaveBeenCalledWith(['1570000000000003'])
  })

  it('не спрашивает, если все найденные счета уже подтверждены', () => {
    const { container } = render(
      <ImportScreen
        onImport={() => {}}
        onConfirmAccounts={() => {}}
        detectedAccounts={['1570000000000001', '1570000000000002']}
        ownAccounts={['1570000000000002', '1570000000000001']}
      />,
    )
    expect(within(container).queryByTestId('accounts-prompt')).toBeNull()
  })

  it('даёт отказаться от предложенных счетов и снять галочку с отдельного', () => {
    const onConfirmAccounts = vi.fn()
    const onDeclineAccounts = vi.fn()
    const { container } = render(
      <ImportScreen
        onImport={() => {}}
        onConfirmAccounts={onConfirmAccounts}
        onDeclineAccounts={onDeclineAccounts}
        detectedAccounts={['1570000000000001', '1570000000000002']}
        ownAccounts={[]}
      />,
    )
    const prompt = within(container).getByTestId('accounts-prompt')
    fireEvent.click(within(prompt).getByRole('button', { name: /не мои/i }))
    expect(onDeclineAccounts).toHaveBeenCalled()

    fireEvent.click(within(prompt).getByLabelText('1570…0001'))
    fireEvent.click(within(prompt).getByRole('button', { name: /подтвердить счета/i }))
    expect(onConfirmAccounts).toHaveBeenCalledWith(['1570000000000002'])
  })

  it('показывает ноль требующих внимания без упоминания счётов', () => {
    const { container } = render(
      <ImportScreen
        onImport={() => {}}
        onConfirmAccounts={() => {}}
        report={{ rows: 10, added: 10, duplicates: 0, unresolved: 0,
          periodFrom: '2026-09-01', periodTo: '2026-09-10' }}
      />,
    )
    // Check that report panel contains the unresolved count line
    const reportPanel = container.querySelector('.panel')
    expect(reportPanel.textContent).toMatch(/Требуют внимания: 0/)
    // Should not show the "unrecognised accounts" explanation with zero count
    expect(reportPanel.textContent).not.toMatch(/ни один счёт операции не опознан/)
  })

  it('не показывает старый отчёт когда есть ошибка', () => {
    const { container } = render(
      <ImportScreen
        onImport={() => {}}
        onConfirmAccounts={() => {}}
        report={null}
        error="Файл повреждён"
      />,
    )
    expect(screen.getByText(/Файл повреждён/)).toBeTruthy()
    // The report panel should not be rendered when report is null
    const reportPanel = container.querySelector('.panel')
    expect(reportPanel).toBeNull()
  })

  it('показывает ошибку если браузер не может прочитать файл', () => {
    const onImport = vi.fn()

    // Stub FileReader to trigger onerror
    const OriginalFileReader = window.FileReader
    class MockFileReader {
      readAsArrayBuffer() {
        // Call onerror immediately to simulate failure
        if (this.onerror) {
          this.onerror()
        }
      }
    }
    window.FileReader = MockFileReader

    try {
      const { container } = render(
        <ImportScreen
          onImport={onImport}
          onConfirmAccounts={() => {}}
        />,
      )

      // Trigger file input
      const fileInput = container.querySelector('input[type="file"]')
      const file = new File(['test'], 'test.xlsx')
      fireEvent.change(fileInput, { target: { files: [file] } })

      // Verify onImport was called with an Error
      expect(onImport).toHaveBeenCalled()
      const arg = onImport.mock.calls[0][0]
      expect(arg).toBeInstanceOf(Error)
      expect(arg.message).toMatch(/Не удалось прочитать файл/)
    } finally {
      // Restore original FileReader
      window.FileReader = OriginalFileReader
    }
  })

  it('сбрасывает value инпута после выбора файла — иначе повторный выбор того же файла не пришлёт change в браузере', async () => {
    const onImport = vi.fn()
    // Этот файл не вызывает cleanup() между тестами (как и соседние тесты
    // выше), поэтому берём инпут из своего собственного container, а не
    // из document — иначе можно случайно задеть DOM предыдущего теста.
    const { container } = render(<ImportScreen onImport={onImport} onConfirmAccounts={() => {}} />)
    const input = container.querySelector('input[type="file"]')
    const file = new File(['test'], 'export.xlsx')
    Object.defineProperty(input, 'files', { value: [file], configurable: true })
    // Реальный браузер после выбора файла заполняет value ("C:\fakepath\…").
    // jsdom не воспроизводит эту связку с files автоматически (файлы
    // подставлены вручную выше), поэтому выставляем value вручную —
    // это и есть то самое свойство, от которого зависит повторный выбор
    // того же файла, и единственное, что jsdom позволяет тут проверить.
    Object.defineProperty(input, 'value', {
      value: 'C:\\fakepath\\export.xlsx', writable: true, configurable: true,
    })

    fireEvent.change(input)
    // Решающая проверка: без сброса value в обработчике эта строка не
    // пройдёт.
    expect(input.value).toBe('')

    // Выбираем тот же файл ещё раз — в реальном браузере это сработает
    // только потому что value уже был сброшен.
    fireEvent.change(input)
    await waitFor(() => expect(onImport).toHaveBeenCalledTimes(2))
  })
})
