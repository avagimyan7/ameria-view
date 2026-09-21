import { useMemo, useState } from 'react'
import { filterTransactions, NO_CATEGORY } from '../stats/filter.js'
import { rulePreview, ruleMatches } from '../rules/match.js'
import { suggestRuleText } from '../rules/normalize.js'
import { formatDate, formatMoney } from './format.js'

export function TransactionsScreen({
  transactions, categories, onAssign, onCreateRule, initialFilters = {}, initialSort = 'date',
  currency = null,
}) {
  const [filters, setFilters] = useState(initialFilters)
  const [sort, setSort] = useState(initialSort)
  const [pendingRule, setPendingRule] = useState(null)

  // Пресет «Разобрать» открывается с валютой, активной на момент клика, но эта
  // валюта не должна застыть: переключение валюты в App должно тут же поменять
  // очередь. Обычный список операций (initialFilters без currency) валютой
  // вообще не интересуется — этот флаг решается один раз, при монтировании,
  // и дальше отличает «это queue» от «это обычный список».
  const [followsActiveCurrency] = useState(initialFilters.currency !== undefined)
  const effectiveFilters = followsActiveCurrency ? { ...filters, currency } : filters

  const visible = useMemo(() => {
    const rows = filterTransactions(transactions, effectiveFilters)
    return sort === 'amount'
      ? [...rows].sort((a, b) => b.amount - a.amount)
      : [...rows].sort((a, b) => b.date.localeCompare(a.date))
  }, [transactions, effectiveFilters, sort])
  const set = (field) => (event) =>
    setFilters((current) => ({ ...current, [field]: event.target.value || undefined }))

  const assign = (tx, categoryId) => {
    // Пустое значение — это осознанное «снять категорию», а не отсутствие выбора.
    // Оно тоже уходит в пометки: иначе снять однажды поставленную категорию было бы нельзя,
    // а categorize() отличает «пометки нет» от «человек явно выбрал без категории»
    // по наличию ключа, а не по истинности значения.
    onAssign(tx.key, categoryId)
    if (!categoryId) {
      setPendingRule(null)
      return
    }
    const match = suggestRuleText(tx)
    if (match) setPendingRule({ match, category: categoryId, sourceKey: tx.key })
  }

  // rulePreview суммирует совпадения текстового правила без оглядки на валюту —
  // и правильно, у текстового паттерна нет своей валюты. Но показать эту сумму
  // одним числом с одной подписью можно только когда совпадения сами лежат
  // в одной валюте; иначе это ровно та тихая ложь, ради которой существует
  // вся задача (драмы и доллары под одним знаком ֏).
  const previewCandidates = pendingRule
    ? transactions.filter((t) => t.key !== pendingRule.sourceKey)
    : []
  const preview = pendingRule ? rulePreview(previewCandidates, pendingRule) : null
  const previewCurrencies = pendingRule
    ? new Set(previewCandidates.filter((t) => ruleMatches(t, pendingRule)).map((t) => t.currency))
    : new Set()
  const previewAmountText =
    previewCurrencies.size === 1
      ? ` на ${formatMoney(preview.amount, [...previewCurrencies][0])}`
      : previewCurrencies.size > 1
        ? ' в нескольких валютах — общую сумму показать нельзя'
        : ''

  return (
    <div>
      {filters.countableOnly && (
        <div className="panel" style={{ marginBottom: 8 }}>
          <p className="muted" style={{ fontSize: 12, margin: 0 }}>
            Только учитываемые операции
            <button
              type="button"
              onClick={() => setFilters((current) => ({ ...current, countableOnly: undefined }))}
              style={{ marginLeft: 8, padding: '2px 6px', fontSize: 12 }}
            >
              Показать все
            </button>
          </p>
        </div>
      )}
      <div className="panel" style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <input placeholder="Поиск по деталям" onChange={set('query')} />
        <input type="date" onChange={set('from')} />
        <input type="date" onChange={set('to')} />
        <select value={filters.direction ?? ''} onChange={set('direction')}>
          <option value="">Все направления</option>
          <option value="expense">Расходы</option>
          <option value="income">Доходы</option>
          <option value="internal">Между своими счетами</option>
          <option value="unresolved">Требуют внимания</option>
        </select>
        <select value={filters.categoryId ?? ''} onChange={set('categoryId')}>
          <option value="">Все категории</option>
          <option value={NO_CATEGORY}>Без категории</option>
          {categories.map((category) => (
            <option key={category.id} value={category.id}>{category.name}</option>
          ))}
        </select>
        <select value={sort} onChange={(event) => setSort(event.target.value)} aria-label="Сортировка">
          <option value="date">Сначала свежие</option>
          <option value="amount">Сначала крупные</option>
        </select>
      </div>

      {pendingRule && preview && (
        <div className="panel" style={{ marginTop: 12 }}>
          <p>
            Правило «{pendingRule.match}» затронет ещё {preview.count} операций{previewAmountText}.
          </p>
          <button type="button" onClick={() => { onCreateRule({ match: pendingRule.match, category: pendingRule.category }); setPendingRule(null) }}>
            Создать правило
          </button>
          <button type="button" onClick={() => setPendingRule(null)}>Не надо</button>
        </div>
      )}

      <div className="panel" style={{ marginTop: 12 }}>
        <table>
          <thead>
            <tr>
              <th>Дата</th>
              <th>Детали</th>
              <th>Категория</th>
              <th className="num">Сумма</th>
            </tr>
          </thead>
          <tbody>
            {visible.map((tx) => (
              <tr key={tx.key}>
                <td className="muted">{formatDate(tx.date)}</td>
                <td>
                  {tx.details || tx.counterparty}
                  <div className="muted" style={{ fontSize: 12 }}>{tx.opType}</div>
                </td>
                <td>
                  <select
                    data-testid={`assign-${tx.key}`}
                    value={tx.categoryId ?? ''}
                    onChange={(event) => assign(tx, event.target.value)}
                  >
                    <option value="">Без категории</option>
                    {categories.map((category) => (
                      <option key={category.id} value={category.id}>{category.name}</option>
                    ))}
                  </select>
                </td>
                <td className={`num ${tx.direction === 'income' ? 'income' : tx.direction === 'expense' ? 'expense' : 'muted'}`}>
                  {formatMoney(tx.amount, tx.currency)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
