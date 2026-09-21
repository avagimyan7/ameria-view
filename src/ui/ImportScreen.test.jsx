import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
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
})
