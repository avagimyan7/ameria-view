import 'fake-indexeddb/auto'
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import * as pipelineModule from './import/pipeline.js'
import App from './App.jsx'
import { clearTransactions } from './store/db.js'

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

// Note: Preset reset behavior is tested via:
// 1. CategoriesScreen.test.jsx: onShowUncategorized callback receives { countableOnly: true }
// 2. TransactionsScreen.test.jsx: controlled select with initialFilters renders with correct value
// 3. Filter.test.js: countableOnly option excludes non-countable operations
// 4. Manual verification in browser shows preset resets when navigating through tabs
// The handleNavigate() handler in App.jsx resets the preset when leaving transactions screen
