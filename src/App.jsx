import { useEffect, useMemo, useState } from 'react'
import './ui/theme.css'
import { Layout } from './ui/Layout.jsx'
import { ImportScreen } from './ui/ImportScreen.jsx'
import { OverviewScreen } from './ui/OverviewScreen.jsx'
import { TransactionsScreen } from './ui/TransactionsScreen.jsx'
import { CategoriesScreen } from './ui/CategoriesScreen.jsx'
import { SettingsScreen } from './ui/SettingsScreen.jsx'
import { importWorkbook } from './import/pipeline.js'
import { applyCategories } from './rules/match.js'
import { loadSettings, saveSettings } from './store/settings.js'
import { loadTransactions, saveTransactions } from './store/db.js'
import { byMonth, currenciesOf } from './stats/aggregate.js'
import { NO_CATEGORY } from './stats/filter.js'

export default function App() {
  const [screen, setScreen] = useState('import')
  const [settings, setSettings] = useState(() => loadSettings())
  const [transactions, setTransactions] = useState([])
  const [report, setReport] = useState(null)
  const [detectedAccounts, setDetectedAccounts] = useState([])
  const [error, setError] = useState(null)
  const [transactionsPreset, setTransactionsPreset] = useState({ filters: {}, sort: 'date' })

  // Банк не даёт курсов обмена, поэтому смешивать AMD и, например, USD в одной сумме
  // нельзя — агрегаты падают, если валют несколько, а какая нужна не сказано явно.
  // По умолчанию берём первую встреченную валюту; переключатель ниже позволяет сменить.
  const currencies = useMemo(() => currenciesOf(transactions), [transactions])
  const [currency, setCurrency] = useState(null)
  const activeCurrency = currency ?? currencies[0] ?? null

  useEffect(() => {
    loadTransactions().then((stored) => {
      setTransactions(applyCategories(stored, settings))
      if (stored.length > 0) setScreen('overview')
    })
    // Настройки читаются один раз при старте; дальше состояние ведёт приложение.
  }, [])

  const updateSettings = (next) => {
    setSettings(next)
    saveSettings(next)
    setTransactions((current) => applyCategories(current, next))
  }

  const handleAssign = (key, categoryId) =>
    updateSettings({ ...settings, overrides: { ...settings.overrides, [key]: categoryId } })

  const handleCreateRule = (rule) =>
    updateSettings({ ...settings, rules: [rule, ...settings.rules] })

  const handleImport = async (bytesOrError) => {
    try {
      setError(null)
      setReport(null)
      setDetectedAccounts([])

      if (bytesOrError instanceof Error) {
        setError(bytesOrError.message)
        return
      }

      const result = importWorkbook(bytesOrError, {
        existingTransactions: transactions,
        ownAccounts: settings.ownAccounts,
      })
      const categorized = applyCategories(result.transactions, settings)
      await saveTransactions(categorized)
      setTransactions(categorized)
      setDetectedAccounts(result.detectedAccounts)
      setReport(result.report)
    } catch (importError) {
      setError(importError.message)
    }
  }

  const handleNavigate = (nextScreen) => {
    // Reset transactionsPreset when navigating away from transactions screen
    // This ensures the preset doesn't persist when returning via normal tab navigation
    if (screen === 'transactions' && nextScreen !== 'transactions') {
      setTransactionsPreset({ filters: {}, sort: 'date' })
    }
    setScreen(nextScreen)
  }

  return (
    <Layout screen={screen} onNavigate={handleNavigate}>
      {currencies.length > 1 && (
        <div className="panel" style={{ marginBottom: 12 }}>
          <label>
            Валюта:{' '}
            <select
              aria-label="Валюта"
              value={activeCurrency ?? ''}
              onChange={(event) => setCurrency(event.target.value)}
            >
              {currencies.map((code) => (
                <option key={code} value={code}>{code}</option>
              ))}
            </select>
          </label>
        </div>
      )}
      {screen === 'import' && (
        <ImportScreen
          onImport={handleImport}
          onConfirmAccounts={(accounts) => updateSettings({ ...settings, ownAccounts: accounts })}
          report={report}
          detectedAccounts={detectedAccounts}
          ownAccounts={settings.ownAccounts}
          error={error}
        />
      )}
      {screen === 'overview' && (
        <OverviewScreen
          transactions={transactions}
          categories={settings.categories}
          currency={activeCurrency}
        />
      )}
      {screen === 'transactions' && (
        <TransactionsScreen
          key={`${transactionsPreset.sort}-${transactionsPreset.filters.categoryId ?? ''}`}
          transactions={transactions}
          categories={settings.categories}
          onAssign={handleAssign}
          onCreateRule={handleCreateRule}
          initialFilters={transactionsPreset.filters}
          initialSort={transactionsPreset.sort}
        />
      )}
      {screen === 'categories' && (
        <CategoriesScreen
          transactions={transactions}
          categories={settings.categories}
          budgets={settings.budgets}
          month={byMonth(transactions, activeCurrency).slice(-1)[0]?.month ?? new Date().toISOString().slice(0, 7)}
          today={new Date().toISOString().slice(0, 10)}
          currency={activeCurrency}
          onChangeBudget={(categoryId, limit) =>
            updateSettings({ ...settings, budgets: { ...settings.budgets, [categoryId]: limit } })}
          onShowUncategorized={() => {
            setTransactionsPreset({
              filters: { categoryId: NO_CATEGORY, countableOnly: true, currency: activeCurrency },
              sort: 'amount',
            })
            setScreen('transactions')
          }}
        />
      )}
      {screen === 'settings' && (
        <SettingsScreen settings={settings} onChange={updateSettings} />
      )}
    </Layout>
  )
}
