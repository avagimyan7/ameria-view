import { useState } from 'react'
import {
  serializeSettings, parseSettingsFile, rulesFile, personalFile,
} from '../store/settings.js'
import { maskAccount } from './format.js'

const LOADED_TEXT = {
  rules: 'загружен rules.json: категории, правила и бюджеты',
  personal: 'загружен personal.json: счета и ручные пометки',
}

export function SettingsScreen({ settings, onChange }) {
  const [error, setError] = useState(null)
  const [notice, setNotice] = useState(null)

  const removeAccount = (account) =>
    onChange({ ...settings, ownAccounts: settings.ownAccounts.filter((item) => item !== account) })

  const moveRule = (index, delta) => {
    const rules = [...settings.rules]
    const target = index + delta
    if (target < 0 || target >= rules.length) return
    ;[rules[index], rules[target]] = [rules[target], rules[index]]
    onChange({ ...settings, rules })
  }

  const removeRule = (index) =>
    onChange({ ...settings, rules: settings.rules.filter((_, i) => i !== index) })

  // Скачивание через Blob — это работа с локальным файлом, а не сетевой запрос.
  const download = (name, content) => {
    const blob = new Blob([serializeSettings(content)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = name
    link.click()
    URL.revokeObjectURL(url)
  }

  const importSettings = (file) => {
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => {
      try {
        const { kinds, fields } = parseSettingsFile(String(reader.result))
        // Накладываем только поля загруженного файла на ТЕКУЩИЕ настройки, а не на
        // значения по умолчанию: иначе загрузка rules.json сбросила бы счета и все
        // ручные пометки. Поля, которых нет ни в одном файле (opTypeCategories),
        // текущие настройки несут всегда — они тоже не теряются.
        setError(null)
        setNotice(kinds.map((kind) => LOADED_TEXT[kind]).join('; '))
        onChange({ ...settings, ...fields })
      } catch (parseError) {
        // Ошибка разбора, несовпадение версии или поле неверного вида: текущие
        // настройки не трогаем — плохой файл не может заменить хорошие данные.
        setNotice(null)
        setError(parseError.message)
      }
    }
    reader.readAsText(file)
  }

  const nameOf = (id) => settings.categories.find((c) => c.id === id)?.name ?? id

  return (
    <div>
      <div className="panel">
        <h3>Мои счета</h3>
        <p className="muted">
          От этого списка зависит, что считается доходом, что расходом, а что —
          перекладыванием денег между своими счетами.
        </p>
        <ul>
          {settings.ownAccounts.map((account) => (
            <li key={account}>
              {maskAccount(account)}{' '}
              <button
                type="button"
                data-testid={`remove-account-${account}`}
                onClick={() => removeAccount(account)}
              >
                убрать
              </button>
            </li>
          ))}
        </ul>
      </div>

      <div className="panel" style={{ marginTop: 12 }}>
        <h3>Правила категорий</h3>
        <p className="muted">Срабатывает первое подходящее правило сверху.</p>
        <table>
          <tbody>
            {settings.rules.map((rule, index) => (
              <tr key={`${rule.match}-${index}`}>
                <td>{rule.match}</td>
                <td>{nameOf(rule.category)}</td>
                <td className="muted">{rule.direction ?? ''}</td>
                <td>
                  <button type="button" data-testid={`rule-up-${index}`} onClick={() => moveRule(index, -1)}>
                    вверх
                  </button>
                  <button type="button" data-testid={`rule-remove-${index}`} onClick={() => removeRule(index)}>
                    удалить
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="panel" style={{ marginTop: 12 }} data-testid="settings-files">
        <h3>Файлы настроек</h3>
        <p className="muted">
          Транзакции всегда можно выгрузить из банка заново, а ручную работу — нет.
          Поэтому она выгружается двумя файлами.
        </p>
        <p className="muted">
          rules.json — категории, правила и бюджеты. Личного в нём нет, его можно держать
          в репозитории: из него же сборка берёт стартовые правила.
        </p>
        <p className="muted">
          personal.json — номера твоих счетов и ручные пометки операций. Ключ пометки — целая
          строка выписки: контрагент, оба счёта, сумма, дата. Этот файл нельзя класть в git
          (он в .gitignore) — храни его отдельно.
        </p>
        <p className="muted">
          Загрузить можно любой из двух: приложение само поймёт какой и заменит только его поля.
        </p>
        <button type="button" onClick={() => download('rules.json', rulesFile(settings))}>
          Выгрузить rules.json
        </button>{' '}
        <button type="button" onClick={() => download('personal.json', personalFile(settings))}>
          Выгрузить personal.json
        </button>
        <input
          data-testid="settings-file"
          type="file"
          accept="application/json,.json"
          onChange={(event) => {
            importSettings(event.target.files[0])
            // Сбросить value: без этого повторный выбор того же файла
            // (например, после исправления и пересохранения того же rules.json)
            // не вызовет change в браузере, и повторная попытка молча ничего
            // не сделает.
            event.target.value = ''
          }}
        />
        {error && <p className="expense">{error}</p>}
        {notice && <p className="muted">{notice[0].toUpperCase() + notice.slice(1)}.</p>}
      </div>
    </div>
  )
}
