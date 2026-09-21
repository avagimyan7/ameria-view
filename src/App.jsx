import { useEffect, useMemo, useRef, useState } from 'react'
import './ui/theme.css'
import { Layout } from './ui/Layout.jsx'
import { ImportScreen } from './ui/ImportScreen.jsx'
import { OverviewScreen } from './ui/OverviewScreen.jsx'
import { TransactionsScreen } from './ui/TransactionsScreen.jsx'
import { CategoriesScreen } from './ui/CategoriesScreen.jsx'
import { SettingsScreen } from './ui/SettingsScreen.jsx'
import { importWorkbook } from './import/pipeline.js'
import { effectiveOwnAccounts } from './import/accounts.js'
import { deriveDirections } from './import/transactions.js'
import { localIsoDate, monthOf } from './import/date.js'
import { applyCategories } from './rules/match.js'
import { loadSettings, saveSettings } from './store/settings.js'
import { loadTransactions, saveTransactions } from './store/db.js'
import { loadImports, recordImport } from './store/imports.js'
import { byMonth, currenciesOf, isCountable } from './stats/aggregate.js'
import { NO_CATEGORY } from './stats/filter.js'

// Направление и категория — производные от настроек, а не данные операции.
// Сначала направление (правила могут быть сужены по нему), затем категории.
// Так подтверждение нового своего счёта сразу переклассифицирует всю историю,
// без повторного импорта.
function derive(transactions, settings) {
  const own = effectiveOwnAccounts(settings.ownAccounts, transactions)
  return applyCategories(deriveDirections(transactions, own), settings)
}

// Подтверждённые счета добавляются к уже известным, а не заменяют их.
function addAccounts(current, confirmed) {
  return Array.from(new Set([...current, ...confirmed])).sort()
}

export default function App() {
  // Всегда с обзора: без данных он сам покажет пустое состояние и позовёт в импорт.
  const [screen, setScreen] = useState('overview')
  const [settings, setSettings] = useState(() => loadSettings())
  // Эффект первой загрузки читает настройки в момент, когда хранилище ответило,
  // а не те, что были при первом рендере: человек успевает их поменять.
  const settingsRef = useRef(settings)
  const [transactions, setTransactions] = useState([])
  // Пока сохранённые операции не загружены, импорт закрыт: иначе он сольётся
  // с пустым списком, назовёт сохранённое «добавленным», а потом загрузка
  // перетрёт результат на экране устаревшим списком.
  const [loaded, setLoaded] = useState(false)
  const [loadError, setLoadError] = useState(null)
  const [report, setReport] = useState(null)
  const [imports, setImports] = useState(() => loadImports())
  const [detectedAccounts, setDetectedAccounts] = useState([])
  const [error, setError] = useState(null)
  const [transactionsPreset, setTransactionsPreset] = useState({ filters: {}, sort: 'date' })

  // Банк не даёт курсов обмена, поэтому смешивать AMD и, например, USD в одной сумме
  // нельзя — агрегаты падают, если валют несколько, а какая нужна не сказано явно.
  // По умолчанию берём первую встреченную валюту; переключатель ниже позволяет сменить.
  const currencies = useMemo(() => currenciesOf(transactions), [transactions])
  const [currency, setCurrency] = useState(null)
  // Выбранная валюта могла перестать встречаться в данных (например, после
  // повторного импорта): держаться за неё дальше нельзя — это тот же дефект,
  // что «фантомный месяц» в OverviewScreen (Task 18), решается тем же приёмом —
  // используем выбор, только пока он реально есть среди текущих валют.
  const activeCurrency = currencies.includes(currency) ? currency : currencies[0] ?? null

  useEffect(() => {
    let cancelled = false
    loadTransactions()
      .then((stored) => {
        if (cancelled) return
        setTransactions(derive(stored, settingsRef.current))
        setLoaded(true)
      })
      .catch((failure) => {
        if (cancelled) return
        // Импорт остаётся закрытым: слияние с непрочитанным хранилищем дало бы
        // неверный отчёт и неверный список на экране.
        setLoadError(
          `Не удалось прочитать сохранённые операции: ${failure?.message ?? failure}. ` +
            'Импорт отключён, чтобы не выдать сохранённое за новое. Перезагрузи страницу.',
        )
      })
    return () => {
      cancelled = true
    }
  }, [])

  const updateSettings = (next) => {
    settingsRef.current = next
    setSettings(next)
    saveSettings(next)
    setTransactions((current) => derive(current, next))
  }

  const handleAssign = (key, categoryId) =>
    updateSettings({ ...settings, overrides: { ...settings.overrides, [key]: categoryId } })

  const handleCreateRule = (rule) =>
    updateSettings({ ...settings, rules: [rule, ...settings.rules] })

  const handleImport = async (bytesOrError, file = {}) => {
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
      const derived = derive(result.transactions, settings)
      await saveTransactions(derived)
      setTransactions(derived)
      setDetectedAccounts(result.detectedAccounts)

      // Что из файла пришло впервые: для отчёта «разложено / без категории»
      // и очереди разбора прямо в отчёте.
      const known = new Set(transactions.map((tx) => tx.key))
      const fresh = derived.filter((tx) => !known.has(tx.key))
      const uncategorizedKeys = fresh
        .filter((tx) => isCountable(tx) && !tx.categoryId)
        .sort((a, b) => b.amount - a.amount)
        .map((tx) => tx.key)
      setReport({
        ...result.report,
        fileName: file.name ?? null,
        fileSize: file.size ?? null,
        categorized: fresh.filter((tx) => tx.categoryId).length,
        uncategorizedKeys,
      })
      setImports(recordImport({
        name: file.name ?? 'выгрузка',
        size: file.size ?? null,
        importedAt: localIsoDate(),
        added: result.report.added,
        duplicates: result.report.duplicates,
        rows: result.report.rows,
        periodFrom: result.report.periodFrom,
        periodTo: result.report.periodTo,
      }))
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
    // Отчёт — ответ на только что загруженный файл. Вернувшись на «Импорт» позже,
    // человек ждёт зону загрузки и историю; неотвеченное предложение счетов остаётся.
    if (screen === 'import' && nextScreen !== 'import') {
      setReport(null)
      setError(null)
    }
    setScreen(nextScreen)
  }

  return (
    <Layout screen={screen} onNavigate={handleNavigate}>
      {loadError && (
        <p className="error" role="alert" style={{ marginBottom: 14 }}>{loadError}</p>
      )}
      {currencies.length > 1 && (
        <div className="currency-bar">
          <span className="soft">Валюта</span>
          <select
            className="chip"
            aria-label="Валюта"
            value={activeCurrency ?? ''}
            onChange={(event) => setCurrency(event.target.value)}
          >
            {currencies.map((code) => (
              <option key={code} value={code}>{code}</option>
            ))}
          </select>
        </div>
      )}
      {screen === 'import' && (
        <ImportScreen
          onImport={handleImport}
          onConfirmAccounts={(accounts) => {
            updateSettings({ ...settings, ownAccounts: addAccounts(settings.ownAccounts, accounts) })
            setDetectedAccounts([])
          }}
          onDeclineAccounts={() => setDetectedAccounts([])}
          report={report}
          detectedAccounts={detectedAccounts}
          ownAccounts={settings.ownAccounts}
          error={error}
          disabled={!loaded}
          imports={imports}
          transactions={transactions}
          categories={settings.categories}
          onAssign={handleAssign}
          onCreateRule={handleCreateRule}
          onNavigate={handleNavigate}
          onReset={() => { setReport(null); setError(null) }}
          onReview={(fileReport) => {
            // Очередь разбора — за период загруженного файла.
            setTransactionsPreset({
              filters: {
                categoryId: NO_CATEGORY, countableOnly: true, currency: activeCurrency,
                from: fileReport.periodFrom, to: fileReport.periodTo,
              },
              sort: 'amount',
            })
            setReport(null)
            setScreen('transactions')
          }}
        />
      )}
      {screen === 'overview' && (
        <OverviewScreen
          transactions={transactions}
          categories={settings.categories}
          currency={activeCurrency}
          loaded={loaded}
          onNavigate={handleNavigate}
          lastImport={imports[0]?.importedAt ?? null}
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
          currency={activeCurrency}
          accounts={settings.ownAccounts}
        />
      )}
      {screen === 'categories' && (
        <CategoriesScreen
          transactions={transactions}
          categories={settings.categories}
          budgets={settings.budgets}
          month={byMonth(transactions, activeCurrency).slice(-1)[0]?.month ?? monthOf(localIsoDate())}
          today={localIsoDate()}
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
