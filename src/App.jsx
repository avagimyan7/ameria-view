import { useEffect, useState } from 'react'
import './ui/theme.css'
import { Layout } from './ui/Layout.jsx'
import { ImportScreen } from './ui/ImportScreen.jsx'
import { OverviewScreen } from './ui/OverviewScreen.jsx'
import { importWorkbook } from './import/pipeline.js'
import { applyCategories } from './rules/match.js'
import { loadSettings, saveSettings } from './store/settings.js'
import { loadTransactions, saveTransactions } from './store/db.js'

export default function App() {
  const [screen, setScreen] = useState('import')
  const [settings, setSettings] = useState(() => loadSettings())
  const [transactions, setTransactions] = useState([])
  const [report, setReport] = useState(null)
  const [detectedAccounts, setDetectedAccounts] = useState([])
  const [error, setError] = useState(null)

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

  return (
    <Layout screen={screen} onNavigate={setScreen}>
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
        <OverviewScreen transactions={transactions} categories={settings.categories} />
      )}
      {['categories', 'transactions', 'settings'].includes(screen) && (
        <p className="muted">Экран в разработке</p>
      )}
    </Layout>
  )
}
