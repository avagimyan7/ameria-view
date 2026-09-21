import { useState } from 'react'
import { defaultSettings, serializeSettings, parseSettings } from '../store/settings.js'
import { maskAccount } from './format.js'

export function SettingsScreen({ settings, onChange }) {
  const [error, setError] = useState(null)

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
  const exportSettings = () => {
    const blob = new Blob([serializeSettings(settings)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = 'rules.json'
    link.click()
    URL.revokeObjectURL(url)
  }

  const importSettings = (file) => {
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => {
      try {
        const parsed = parseSettings(String(reader.result))
        // Старые выгрузки могут не содержать полей, добавленных позже
        // (например opTypeCategories). Накладываем разобранный файл поверх
        // настроек по умолчанию, чтобы отсутствующее поле не пропадало молча,
        // а бралось из дефолта, а не приводило к падению разметки.
        setError(null)
        onChange({ ...defaultSettings(), ...parsed })
      } catch (parseError) {
        // Ошибка разбора или несовпадение версии: текущие настройки не трогаем,
        // onChange не вызывается — плохой файл не может заменить хорошие данные.
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

      <div className="panel" style={{ marginTop: 12 }}>
        <h3>Разметка</h3>
        <p className="muted">
          Транзакции всегда можно выгрузить из банка заново, а ручную разметку — нет.
          Держи rules.json в репозитории.
        </p>
        <button type="button" onClick={exportSettings}>Выгрузить rules.json</button>
        <input
          data-testid="settings-file"
          type="file"
          accept="application/json,.json"
          onChange={(event) => importSettings(event.target.files[0])}
        />
        {error && <p className="expense">{error}</p>}
      </div>
    </div>
  )
}
