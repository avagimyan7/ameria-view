import { useState } from 'react'
import { formatDate, maskAccount } from './format.js'

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
    <div className="panel" style={{ marginTop: 20 }} data-testid="accounts-prompt">
      <h3>Найденные счета</h3>
      <p className="muted">
        Эти счета похожи на твои, но ещё не подтверждены. От них зависит, что считается
        доходом, что расходом, а что — перекладыванием между своими счетами.
        Подтверждённые добавятся к уже известным и пересчитают всю историю.
      </p>
      <ul>
        {accounts.map((account) => (
          <li key={account}>
            <label>
              <input
                type="checkbox"
                checked={!unchecked.has(account)}
                onChange={() => toggle(account)}
              />{' '}
              {maskAccount(account)}
            </label>
          </li>
        ))}
      </ul>
      <button type="button" disabled={selected.length === 0} onClick={() => onConfirm(selected)}>
        Подтвердить счета
      </button>{' '}
      <button type="button" onClick={onDecline}>Не мои</button>
    </div>
  )
}

export function ImportScreen({
  onImport, onConfirmAccounts, onDeclineAccounts = () => {}, report, detectedAccounts = [],
  ownAccounts = [], error, disabled = false,
}) {
  const [isOver, setIsOver] = useState(false)

  const readFile = (file) => {
    // disabled — пока приложение не дочитало сохранённые операции.
    if (!file || disabled) return
    const reader = new FileReader()
    reader.onload = () => onImport(new Uint8Array(reader.result))
    reader.onerror = () => {
      const error = new Error('Не удалось прочитать файл')
      onImport(error)
    }
    reader.readAsArrayBuffer(file)
  }

  // Спрашиваем о каждом найденном счёте, которого ещё нет среди подтверждённых, —
  // а не только при пустом списке: иначе новый свой счёт никогда не будет предложен,
  // и переводы на него навсегда останутся расходами. Счёт, который человек убрал
  // в настройках, тоже попадёт сюда, но только как предложение, от которого можно
  // отказаться, — молча он обратно не вернётся.
  const newAccounts = detectedAccounts.filter((account) => !ownAccounts.includes(account))

  return (
    <div>
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
        onClick={() => { if (!disabled) document.getElementById('file-input').click() }}
        aria-disabled={disabled}
      >
        <p>{disabled ? 'Загружаю сохранённые операции…' : 'Перетащи сюда выгрузку из myAmeria или нажми, чтобы выбрать файл'}</p>
        <p className="muted">
          myameria.am/history → кнопка Filter справа → выставь даты → секция Actions → кнопка Excel
        </p>
        <input
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
      </div>

      {error && <p className="expense">{error}</p>}

      {report && (
        <div className="panel" style={{ marginTop: 20 }}>
          <h3>Импорт завершён</h3>
          <p>
            Период: {formatDate(report.periodFrom)} — {formatDate(report.periodTo)}
          </p>
          <p>Строк в файле: {report.rows}</p>
          <p>Добавлено: {report.added}</p>
          <p>Дублей: {report.duplicates}</p>
          {report.unresolved > 0 ? (
            <p className="expense">
              Требуют внимания: {report.unresolved} — ни один счёт операции не опознан как твой
            </p>
          ) : (
            <p>Требуют внимания: 0</p>
          )}
        </div>
      )}

      {newAccounts.length > 0 && (
        <AccountsPrompt
          key={newAccounts.join(',')}
          accounts={newAccounts}
          onConfirm={onConfirmAccounts}
          onDecline={onDeclineAccounts}
        />
      )}
    </div>
  )
}
