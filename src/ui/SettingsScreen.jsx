import { useState } from 'react'
import {
  serializeSettings, parseSettingsFile, rulesFile, personalFile,
} from '../store/settings.js'
import { ScreenHeader } from './Layout.jsx'
import { ChipSelect } from './ChipSelect.jsx'
import { MoveUp, Plus, Trash } from './Icons.jsx'
import { maskAccount, pluralRu } from './format.js'

const LOADED_TEXT = {
  rules: 'загружен rules.json: категории, правила и бюджеты',
  personal: 'загружен personal.json: счета и ручные пометки',
}

const DIRECTION_TEXT = { expense: 'только расходы', income: 'только доходы', internal: 'только свои переводы' }

// Сколько правил видно сразу; остальные — под «Ещё».
const VISIBLE_RULES = 8

// Номер счёта из поля ввода: пробелы и дефисы, с которыми номер часто копируют,
// убираются; всё остальное должно быть цифрами. Длина — с запасом вокруг
// шестнадцати цифр Америабанка, чтобы подошли и счета других банков.
function parseAccount(input) {
  const compact = input.replace(/[\s-]/g, '')
  return /^\d{8,24}$/.test(compact) ? compact : null
}

export function SettingsScreen({ settings, onChange }) {
  const [error, setError] = useState(null)
  const [notice, setNotice] = useState(null)
  const [accountInput, setAccountInput] = useState('')
  const [accountError, setAccountError] = useState(null)
  const [ruleText, setRuleText] = useState('')
  const [ruleCategory, setRuleCategory] = useState('')
  const [showAllRules, setShowAllRules] = useState(false)

  const removeAccount = (account) =>
    onChange({ ...settings, ownAccounts: settings.ownAccounts.filter((item) => item !== account) })

  const addAccount = (event) => {
    event.preventDefault()
    const account = parseAccount(accountInput)
    if (!account) {
      setAccountError('Номер счёта — только цифры, от 8 до 24.')
      return
    }
    if (settings.ownAccounts.includes(account)) {
      setAccountError('Этот счёт уже в списке.')
      return
    }
    setAccountError(null)
    setAccountInput('')
    onChange({ ...settings, ownAccounts: [...settings.ownAccounts, account].sort() })
  }

  const addRule = (event) => {
    event.preventDefault()
    const match = ruleText.trim()
    if (!match || !ruleCategory) return
    // Новое правило — первым, как и созданное из списка операций: человек только
    // что сказал, что эти операции — вот это, и старое правило не должно перебить.
    onChange({ ...settings, rules: [{ match, category: ruleCategory }, ...settings.rules] })
    setRuleText('')
  }

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

  const category = (id) => settings.categories.find((c) => c.id === id)
  const rules = showAllRules ? settings.rules : settings.rules.slice(0, VISIBLE_RULES)
  const hiddenRules = settings.rules.length - rules.length

  return (
    <>
      <ScreenHeader title="Настройки" />

      <div className="stack settings">
        <div className="card">
          <div className="card-title">Мои счета</div>
          <p className="card-sub" style={{ marginBottom: 14 }}>
            От этого списка зависит, что считается доходом, что расходом, а что —
            перекладыванием денег между своими счетами.
          </p>
          <div className="tile-list">
            {settings.ownAccounts.map((account) => (
              <div key={account} className="tile account-row">
                <span className="amount">{maskAccount(account)}</span>
                <button
                  type="button" className="btn btn-sm btn-secondary"
                  data-testid={`remove-account-${account}`}
                  onClick={() => removeAccount(account)}
                >
                  убрать
                </button>
              </div>
            ))}
          </div>
          <form className="inline-form" onSubmit={addAccount}>
            <input
              className="field" inputMode="numeric" autoComplete="off" placeholder="Номер счёта"
              value={accountInput}
              onChange={(event) => { setAccountInput(event.target.value); setAccountError(null) }}
            />
            <button type="submit" className="btn btn-sm btn-primary">Добавить</button>
          </form>
          {accountError && <p className="error" style={{ marginTop: 8 }}>{accountError}</p>}
        </div>

        <div className="card">
          <div className="card-title">Правила категорий</div>
          <p className="card-sub" style={{ marginBottom: 14 }}>Срабатывает первое подходящее правило сверху.</p>
          <form className="rule-form" onSubmit={addRule}>
            <input
              className="field" autoComplete="off" placeholder="Текст в деталях"
              value={ruleText} onChange={(event) => setRuleText(event.target.value)}
            />
            <ChipSelect
              className="rule-form-category" ariaLabel="Категория нового правила"
              value={ruleCategory} onChange={setRuleCategory} active={Boolean(ruleCategory)}
              options={[
                { value: '', label: 'Категория' },
                ...settings.categories.map((c) => ({ value: c.id, label: c.name })),
              ]}
            />
            <button
              type="submit" className="icon-btn is-accent" aria-label="Добавить правило"
              disabled={!ruleText.trim() || !ruleCategory}
            >
              <Plus />
            </button>
          </form>
          <div className="tile-list">
            {rules.map((rule, index) => {
              const target = category(rule.category)
              const scope = [DIRECTION_TEXT[rule.direction], rule.opType].filter(Boolean).join(' · ')
              return (
                <div key={`${rule.match}-${index}`} className="tile rule-row">
                  <div className="rule-row-main">
                    <div className="rule-row-match">{rule.match}</div>
                    <div className="rule-row-meta">
                      <span className="dot" style={{ background: target?.color ?? 'var(--text-3)' }} />
                      {target?.name ?? rule.category}
                      {scope && <span className="muted"> · {scope}</span>}
                    </div>
                  </div>
                  <button
                    type="button" className="icon-btn" aria-label="Поднять правило выше"
                    data-testid={`rule-up-${index}`} disabled={index === 0}
                    onClick={() => moveRule(index, -1)}
                  >
                    <MoveUp />
                  </button>
                  <button
                    type="button" className="icon-btn is-danger" aria-label="Удалить правило"
                    data-testid={`rule-remove-${index}`}
                    onClick={() => removeRule(index)}
                  >
                    <Trash />
                  </button>
                </div>
              )
            })}
            {hiddenRules > 0 && (
              <button type="button" className="more-btn" onClick={() => setShowAllRules(true)}>
                Ещё {hiddenRules} {pluralRu(hiddenRules, ['правило', 'правила', 'правил'])}
              </button>
            )}
          </div>
        </div>

        <div className="card" data-testid="settings-files">
          <div className="card-title">Файлы настроек</div>
          <div className="card-sub files-text">
            <p>
              Транзакции всегда можно выгрузить из банка заново, а ручную работу — нет.
              Поэтому она выгружается двумя файлами.
            </p>
            <p>
              <b>rules.json</b> — категории, правила и бюджеты. Личного в нём нет, его можно держать
              в репозитории: из него же сборка берёт стартовые правила.
            </p>
            <p>
              <b>personal.json</b> — номера твоих счетов и ручные пометки операций. Ключ пометки — целая
              строка выписки: контрагент, оба счёта, сумма, дата. Этот файл нельзя класть в git
              (он в .gitignore) — храни его отдельно.
            </p>
            <p>Загрузить можно любой из двух: приложение само поймёт какой и заменит только его поля.</p>
          </div>
          <div className="files-actions">
            <button type="button" className="btn btn-sm btn-secondary" onClick={() => download('rules.json', rulesFile(settings))}>
              Выгрузить rules.json
            </button>
            <button type="button" className="btn btn-sm btn-secondary" onClick={() => download('personal.json', personalFile(settings))}>
              Выгрузить personal.json
            </button>
            <label className="btn btn-sm btn-primary file-button">
              Загрузить файл
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
            </label>
          </div>
          {error && <p className="error" style={{ marginTop: 10 }}>{error}</p>}
          {notice && <p className="notice" style={{ marginTop: 10 }}>{notice[0].toUpperCase() + notice.slice(1)}.</p>}
        </div>
      </div>
    </>
  )
}
