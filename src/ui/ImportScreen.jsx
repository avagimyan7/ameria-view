import { useState } from 'react'
import { formatDate, maskAccount } from './format.js'

export function ImportScreen({ onImport, onConfirmAccounts, report, detectedAccounts = [], ownAccounts = [], error }) {
  const [isOver, setIsOver] = useState(false)

  const readFile = (file) => {
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => onImport(new Uint8Array(reader.result))
    reader.onerror = () => {
      const error = new Error('Не удалось прочитать файл')
      onImport(error)
    }
    reader.readAsArrayBuffer(file)
  }

  const needsConfirmation = detectedAccounts.length > 0 && ownAccounts.length === 0

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
        onClick={() => document.getElementById('file-input').click()}
      >
        <p>Перетащи сюда выгрузку из myAmeria</p>
        <p className="muted">
          myameria.am/history → кнопка Filter справа → выставь даты → секция Actions → кнопка Excel
        </p>
        <input
          id="file-input"
          type="file"
          accept=".xls,.xlsx"
          style={{ display: 'none' }}
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

      {needsConfirmation && (
        <div className="panel" style={{ marginTop: 20 }}>
          <h3>Найденные счета</h3>
          <p className="muted">
            Эти счета определены как твои. От них зависит, что считается доходом, а что расходом.
          </p>
          <ul>
            {detectedAccounts.map((account) => (
              <li key={account}>{maskAccount(account)}</li>
            ))}
          </ul>
          <button type="button" onClick={() => onConfirmAccounts(detectedAccounts)}>
            Подтвердить счета
          </button>
        </div>
      )}
    </div>
  )
}
