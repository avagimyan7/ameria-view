import { useMemo, useState } from 'react'
import { filterTransactions, NO_CATEGORY } from '../stats/filter.js'
import { rulePreview } from '../rules/match.js'
import { suggestRuleText } from '../rules/normalize.js'
import { formatAmd, formatDate } from './format.js'

export function TransactionsScreen({
  transactions, categories, onAssign, onCreateRule, initialFilters = {}, initialSort = 'date',
}) {
  const [filters, setFilters] = useState(initialFilters)
  const [sort, setSort] = useState(initialSort)
  const [pendingRule, setPendingRule] = useState(null)

  const visible = useMemo(() => {
    const rows = filterTransactions(transactions, filters)
    return sort === 'amount'
      ? [...rows].sort((a, b) => b.amount - a.amount)
      : [...rows].sort((a, b) => b.date.localeCompare(a.date))
  }, [transactions, filters, sort])
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

  const preview = pendingRule
    ? rulePreview(transactions.filter((t) => t.key !== pendingRule.sourceKey), pendingRule)
    : null

  return (
    <div>
      <div className="panel" style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <input placeholder="Поиск по деталям" onChange={set('query')} />
        <input type="date" onChange={set('from')} />
        <input type="date" onChange={set('to')} />
        <select onChange={set('direction')}>
          <option value="">Все направления</option>
          <option value="expense">Расходы</option>
          <option value="income">Доходы</option>
          <option value="internal">Между своими счетами</option>
          <option value="unresolved">Требуют внимания</option>
        </select>
        <select onChange={set('categoryId')}>
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
            Правило «{pendingRule.match}» затронет ещё {preview.count} операций
            на {formatAmd(preview.amount)}.
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
                  {formatAmd(tx.amount)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
