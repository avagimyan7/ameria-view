import { useRef, useState } from 'react'
import { isCountable } from '../stats/aggregate.js'
import { ScreenHeader } from './Layout.jsx'
import { ChipSelect } from './ChipSelect.jsx'
import { Check, Download } from './Icons.jsx'
import { useRuleSuggestion } from './useRuleSuggestion.jsx'
import { formatDate, formatDayMonth, formatMoney, maskAccount, pluralRu } from './format.js'

// Сколько неразобранных операций из только что загруженного файла показать прямо в отчёте.
const REPORT_QUEUE = 5

const formatSize = (bytes) =>
  bytes >= 1024 * 1024
    ? `${(bytes / 1024 / 1024).toLocaleString('ru-RU', { maximumFractionDigits: 1 })} МБ`
    : `${Math.max(1, Math.round(bytes / 1024))} КБ`

// Предложение подтвердить новые счета. Отдельный компонент, чтобы выбор галочек
// сбрасывался вместе со списком (он смонтирован с key по этому списку).
function AccountsPrompt({ accounts, onConfirm, onDecline }) {
  const [unchecked, setUnchecked] = useState(() => new Set())
  const toggle = (account) =>
    setUnchecked((current) => {
      const next = new Set(current)
      if (next.has(account)) next.delete(account)
      else next.add(account)
      return next
    })
  const selected = accounts.filter((account) => !unchecked.has(account))

  return (
    <div className="card card-attention" data-testid="accounts-prompt">
      <div className="card-title">Найденные счета</div>
      <p className="card-sub">
        Эти счета похожи на твои, но ещё не подтверждены. От них зависит, что считается
        доходом, что расходом, а что — перекладыванием между своими счетами.
        Подтверждённые добавятся к уже известным и пересчитают всю историю.
      </p>
      <div className="check-list">
        {accounts.map((account) => (
          <label key={account} className="tile check-row">
            <input
              type="checkbox"
              checked={!unchecked.has(account)}
              onChange={() => toggle(account)}
            />
            <span className="amount">{maskAccount(account)}</span>
          </label>
        ))}
      </div>
      <div className="button-row">
        <button type="button" className="btn btn-secondary" onClick={onDecline}>Не мои</button>
        <button type="button" className="btn btn-primary" disabled={selected.length === 0} onClick={() => onConfirm(selected)}>
          Подтвердить счета
        </button>
      </div>
    </div>
  )
}

function Report({ report, pending, categories, onReview, onNavigate, onAnother, assign }) {
  const needsCount = pending.length
  return (
    <>
      <div className="card report" data-testid="import-report">
        <div className="report-head">
          <div className="report-icon"><Check size={22} /></div>
          <div style={{ minWidth: 0 }}>
            <div className="report-title">Файл загружен</div>
            {report.fileName && (
              <div className="report-file">
                {report.fileName}{report.fileSize ? ` · ${formatSize(report.fileSize)}` : ''}
              </div>
            )}
          </div>
        </div>
        <div className="report-stats">
          <div className="report-stat">
            <span>Добавлено</span><strong className="income" data-testid="report-added">{report.added}</strong>
          </div>
          <div className="report-stat">
            <span>Дубликаты</span><strong className="soft" data-testid="report-duplicates">{report.duplicates}</strong>
          </div>
          {report.categorized != null && (
            <div className="report-stat">
              <span>Разложено по правилам</span><strong data-testid="report-categorized">{report.categorized}</strong>
            </div>
          )}
          {report.uncategorizedKeys && (
            <div className="report-stat is-accent">
              <span>Без категории</span><strong className="accent" data-testid="report-uncategorized">{needsCount}</strong>
            </div>
          )}
        </div>
        {report.unresolved > 0 && (
          <p className="report-warning">
            Требуют внимания: {report.unresolved} — ни один счёт операции не опознан как твой
          </p>
        )}
        <div className="report-period">
          <span className="soft">Период</span>
          <strong className="amount">{formatDate(report.periodFrom)} — {formatDate(report.periodTo)}</strong>
        </div>
        <p className="report-meta">
          <span>Строк в файле: {report.rows}</span>
          {report.unresolved > 0 ? null : <span> · Требуют внимания: 0</span>}
        </p>
      </div>

      <div className="button-stack">
        {needsCount > 0 && (
          <button type="button" className="btn btn-primary btn-block" onClick={onReview}>
            Разобрать {needsCount} {pluralRu(needsCount, ['операцию', 'операции', 'операций'])}
          </button>
        )}
        <button
          type="button" className={`btn btn-block ${needsCount > 0 ? 'btn-secondary' : 'btn-primary'}`}
          onClick={() => onNavigate?.('overview')}
        >
          Перейти к обзору
        </button>
      </div>

      {needsCount > 0 && (
        <div className="card">
          <div className="card-title">Что осталось без категории</div>
          <p className="card-sub" style={{ marginBottom: 8 }}>
            Назначь категорию — предложу правило, чтобы похожие разложились сами.
          </p>
          <div className="rows">
            {pending.slice(0, REPORT_QUEUE).map((tx) => (
              <div key={tx.key} className="row queue-row">
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div className="ellipsis">{(tx.details || tx.counterparty || '').replace(/^Ք:\s*/, '')}</div>
                  <div className="queue-meta">{formatDayMonth(tx.date)} · {formatMoney(tx.amount, tx.currency)}</div>
                </div>
                <ChipSelect
                  ariaLabel="Категория операции" testId={`report-assign-${tx.key}`} dashed
                  value="" onChange={(value) => assign(tx, value)}
                  options={[{ value: '', label: 'Выбрать' }, ...categories.map((c) => ({ value: c.id, label: c.name }))]}
                />
              </div>
            ))}
          </div>
          {needsCount > REPORT_QUEUE && (
            <button type="button" className="more-btn rows-foot" onClick={onReview}>
              Все {needsCount} в «Операциях»
            </button>
          )}
        </div>
      )}

      <button type="button" className="more-btn" onClick={onAnother}>Загрузить другой файл</button>
    </>
  )
}

export function ImportScreen({
  onImport, onConfirmAccounts, onDeclineAccounts = () => {}, report, detectedAccounts = [],
  ownAccounts = [], error, disabled = false, imports = [], transactions = [], categories = [],
  onAssign = () => {}, onCreateRule = () => {}, onReview = () => {}, onNavigate, onReset = () => {},
}) {
  const [isOver, setIsOver] = useState(false)
  const inputRef = useRef(null)
  const { assign, sheet } = useRuleSuggestion({ transactions, onAssign, onCreateRule })

  const readFile = (file) => {
    // disabled — пока приложение не дочитало сохранённые операции.
    if (!file || disabled) return
    const reader = new FileReader()
    reader.onload = () => onImport(new Uint8Array(reader.result), { name: file.name, size: file.size })
    reader.onerror = () => {
      const error = new Error('Не удалось прочитать файл')
      onImport(error)
    }
    reader.readAsArrayBuffer(file)
  }
  const pick = () => { if (!disabled) inputRef.current?.click() }

  // Спрашиваем о каждом найденном счёте, которого ещё нет среди подтверждённых, —
  // а не только при пустом списке: иначе новый свой счёт никогда не будет предложен,
  // и переводы на него навсегда останутся расходами. Счёт, который человек убрал
  // в настройках, тоже попадёт сюда, но только как предложение, от которого можно
  // отказаться, — молча он обратно не вернётся.
  const newAccounts = detectedAccounts.filter((account) => !ownAccounts.includes(account))
  // Очередь отчёта — операции этого файла, которые всё ещё ждут категорию: разложенные
  // прямо здесь уходят из неё сразу, как и ставшие переводами между своими счетами
  // после подтверждения счетов.
  const pending = (report?.uncategorizedKeys ?? [])
    .map((key) => transactions.find((tx) => tx.key === key))
    .filter((tx) => tx && !tx.categoryId && isCountable(tx))

  return (
    <>
      <ScreenHeader title="Импорт" />

      {/* Поле выбора файла живёт всегда, и в отчёте тоже: «Загрузить другой файл»
          открывает его же. */}
      <input
        ref={inputRef}
        id="file-input"
        type="file"
        accept=".xls,.xlsx"
        style={{ display: 'none' }}
        disabled={disabled}
        onChange={(event) => {
          readFile(event.target.files[0])
          // Сбросить value: без этого повторный выбор того же файла
          // (например, свежей выгрузки за тот же период с тем же именем)
          // не вызовет change в браузере, и повтор импорта после отказа
          // молча ничего не сделает.
          event.target.value = ''
        }}
      />

      <div className="stack">
        {error && <p className="error" role="alert">{error}</p>}

        {newAccounts.length > 0 && (
          <AccountsPrompt
            key={newAccounts.join(',')}
            accounts={newAccounts}
            onConfirm={onConfirmAccounts}
            onDecline={onDeclineAccounts}
          />
        )}

        {report ? (
          <Report
            report={report} pending={pending} categories={categories}
            onReview={() => onReview(report)} onNavigate={onNavigate}
            onAnother={() => { onReset(); pick() }} assign={assign}
          />
        ) : (
          <>
            <div
              className="dropzone"
              data-over={isOver}
              onDragOver={(event) => { event.preventDefault(); setIsOver(true) }}
              onDragLeave={() => setIsOver(false)}
              onDrop={(event) => {
                event.preventDefault()
                setIsOver(false)
                readFile(event.dataTransfer.files[0])
              }}
              onClick={pick}
              aria-disabled={disabled}
            >
              <div className="dropzone-icon"><Download /></div>
              <p className="dropzone-title">
                {disabled ? 'Загружаю сохранённые операции…' : <>Перетащи сюда выгрузку<br />из myAmeria</>}
              </p>
              <p className="dropzone-hint">Форматы .xls и .xlsx</p>
              <button type="button" className="btn btn-primary" disabled={disabled}
                onClick={(event) => { event.stopPropagation(); pick() }}>
                Выбрать файл
              </button>
            </div>

            <div className="card">
              <div className="card-title" style={{ marginBottom: 14 }}>Где взять файл</div>
              <ol className="steps">
                <li><span>Открой <span className="accent">myameria.am/history</span></span></li>
                <li><span>Нажми кнопку <b>Filter</b> справа и выставь даты</span></li>
                <li><span>В секции <b>Actions</b> нажми <b>Excel</b></span></li>
              </ol>
            </div>

            {imports.length > 0 && (
              <div className="card">
                <div className="card-title" style={{ marginBottom: 12 }}>Последние импорты</div>
                <div className="rows">
                  {imports.map((item, index) => (
                    <div key={`${item.importedAt}-${index}`} className="row history-row">
                      <div className="history-icon"><Check /></div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div className="ellipsis">{item.name}</div>
                        <div className="queue-meta">
                          {formatDayMonth(item.importedAt)} · {item.added}{' '}
                          {pluralRu(item.added, ['новая операция', 'новые операции', 'новых операций'])}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}

      </div>

      {sheet}
    </>
  )
}
