import { useMemo, useState } from 'react'
import { filterTransactions, NO_CATEGORY } from '../stats/filter.js'
import { groupByDay } from '../stats/group.js'
import { formatAmount } from '../import/money.js'
import { ScreenHeader } from './Layout.jsx'
import { Filter, Search, TxGlyph, glyphFor } from './Icons.jsx'
import { ChipSelect } from './ChipSelect.jsx'
import { useRuleSuggestion } from './useRuleSuggestion.jsx'
import {
  currencyLabel, formatDayLong, formatDayMonth, formatSigned, maskAccount, tint,
} from './format.js'

// Сколько операций показывать сразу и сколько добавлять по «Показать ещё».
const PAGE = 50

const AMOUNT_STYLE = {
  expense: { className: 'expense', sign: 'minus' },
  income: { className: 'income', sign: 'plus' },
  internal: { className: 'transfer', sign: null },
}

// «Ք: » — служебная приставка банка у карточных операций; в заголовке она шум.
const titleOf = (tx) => (tx.details || tx.counterparty || '').replace(/^Ք:\s*/, '')

function dayTotal(group) {
  if (!group.currency || (group.income === 0 && group.expense === 0)) return ''
  const parts = []
  if (group.income > 0) parts.push(`+${formatAmount(group.income)}`)
  if (group.expense > 0) parts.push(`−${formatAmount(group.expense)}`)
  return `${parts.join(' / ')} ${currencyLabel(group.currency)}`
}

function CategoryChip({ tx, categories, onChange }) {
  const category = categories.find((c) => c.id === tx.categoryId)
  const empty = tx.direction === 'internal' ? 'Между своими счетами' : 'Без категории'
  return (
    <ChipSelect
      className="chip-cat"
      ariaLabel="Категория операции"
      testId={`assign-${tx.key}`}
      value={tx.categoryId ?? ''}
      onChange={onChange}
      dot={category?.color ?? null}
      dashed={!category && tx.direction !== 'internal'}
      options={[{ value: '', label: empty }, ...categories.map((c) => ({ value: c.id, label: c.name }))]}
    />
  )
}

function TxRow({ tx, categories, onAssign }) {
  const category = categories.find((c) => c.id === tx.categoryId)
  const colour = category?.color
    ?? (tx.direction === 'income' ? 'var(--income)' : tx.direction === 'internal' ? 'var(--transfer)' : 'var(--text-3)')
  const style = AMOUNT_STYLE[tx.direction] ?? { className: 'muted', sign: null }
  return (
    <div className="tx" data-testid={`tx-${tx.key}`}>
      <div className="tx-icon" style={{ background: tint(colour), color: colour }}>
        <TxGlyph name={glyphFor(tx)} />
      </div>
      <div className="tx-body">
        <div className="tx-title">{titleOf(tx)}</div>
        <div className="tx-sub">{tx.opType}</div>
        <CategoryChip tx={tx} categories={categories} onChange={(value) => onAssign(tx, value)} />
      </div>
      <div className="tx-side">
        <div className={`tx-amount amount ${style.className}`}>{formatSigned(tx.amount, tx.currency, style.sign)}</div>
        <div className="tx-date">{formatDayMonth(tx.date)}</div>
      </div>
    </div>
  )
}

export function TransactionsScreen({
  transactions, categories, onAssign, onCreateRule, initialFilters = {}, initialSort = 'date',
  currency = null, accounts = [],
}) {
  const [filters, setFilters] = useState(initialFilters)
  const [sort, setSort] = useState(initialSort)
  const [panel, setPanel] = useState(null) // 'period' | 'more' | null
  const [limit, setLimit] = useState(PAGE)

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
  const groups = useMemo(() => groupByDay(visible.slice(0, limit)), [visible, limit])
  const opTypes = useMemo(() => [...new Set(transactions.map((tx) => tx.opType))].sort(), [transactions])

  const setField = (field, value) =>
    setFilters((current) => ({ ...current, [field]: value === '' || value == null ? undefined : value }))
  const set = (field) => (event) => setField(field, event.target.value)
  // Суммы вводят в драмах, а фильтр сравнивает в лумах.
  const setAmount = (field) => (event) =>
    setField(field, event.target.value === '' ? undefined : Math.round(Number(event.target.value) * 100))

  const { assign, sheet } = useRuleSuggestion({ transactions, onAssign, onCreateRule })

  const period = filters.from || filters.to
  const periodLabel = filters.from && filters.to
    ? `${formatDayMonth(filters.from)} — ${formatDayMonth(filters.to)}`
    : filters.from ? `с ${formatDayMonth(filters.from)}` : filters.to ? `по ${formatDayMonth(filters.to)}` : 'Весь период'
  const extraActive = filters.minAmount != null || filters.maxAmount != null || filters.account || filters.opType
  const remaining = visible.length - limit

  return (
    <>
      <ScreenHeader title="Операции">
        <button
          type="button" className="icon-btn is-round accent" aria-label="Ещё фильтры"
          aria-pressed={panel === 'more' || Boolean(extraActive)}
          onClick={() => setPanel((current) => (current === 'more' ? null : 'more'))}
        >
          <Filter />
        </button>
      </ScreenHeader>

      {filters.countableOnly && (
        <div className="filter-note">
          <span>Только учитываемые операции</span>
          <button type="button" className="link-btn" onClick={() => setField('countableOnly', undefined)}>
            Показать все
          </button>
        </div>
      )}

      <div className="search">
        <Search />
        <input
          className="field" type="search" placeholder="Поиск по деталям"
          value={filters.query ?? ''} onChange={set('query')}
        />
      </div>

      <div className="chips tx-filters">
        <button
          type="button" className={`chip chip-button${period ? ' is-active' : ''}`}
          aria-expanded={panel === 'period'}
          onClick={() => setPanel((current) => (current === 'period' ? null : 'period'))}
        >
          {periodLabel}
        </button>
        <ChipSelect
          ariaLabel="Направление" active={Boolean(filters.direction)}
          value={filters.direction ?? ''} onChange={(value) => setField('direction', value)}
          options={[
            { value: '', label: 'Все направления' },
            { value: 'expense', label: 'Расходы' },
            { value: 'income', label: 'Доходы' },
            { value: 'internal', label: 'Между своими счетами' },
            { value: 'unresolved', label: 'Требуют внимания' },
          ]}
        />
        <ChipSelect
          ariaLabel="Категория" active={Boolean(filters.categoryId)}
          value={filters.categoryId ?? ''} onChange={(value) => setField('categoryId', value)}
          options={[
            { value: '', label: 'Все категории' },
            { value: NO_CATEGORY, label: 'Без категории' },
            ...categories.map((category) => ({ value: category.id, label: category.name })),
          ]}
        />
        <ChipSelect
          ariaLabel="Сортировка" value={sort} onChange={setSort}
          options={[{ value: 'date', label: 'Сначала свежие' }, { value: 'amount', label: 'Сначала крупные' }]}
        />
      </div>

      {panel === 'period' && (
        <div className="card filter-panel">
          <label><span>С</span><input className="field" type="date" value={filters.from ?? ''} onChange={set('from')} /></label>
          <label><span>По</span><input className="field" type="date" value={filters.to ?? ''} onChange={set('to')} /></label>
          {period && (
            <button type="button" className="link-btn" onClick={() => { setField('from'); setField('to') }}>
              Весь период
            </button>
          )}
        </div>
      )}

      {panel === 'more' && (
        <div className="card filter-panel">
          <label><span>Сумма от, ֏</span>
            <input className="field" type="number" inputMode="decimal" min="0"
              value={filters.minAmount != null ? filters.minAmount / 100 : ''} onChange={setAmount('minAmount')} />
          </label>
          <label><span>до, ֏</span>
            <input className="field" type="number" inputMode="decimal" min="0"
              value={filters.maxAmount != null ? filters.maxAmount / 100 : ''} onChange={setAmount('maxAmount')} />
          </label>
          <label className="is-wide"><span>Счёт</span>
            <ChipSelect
              ariaLabel="Счёт" active={Boolean(filters.account)}
              value={filters.account ?? ''} onChange={(value) => setField('account', value)}
              options={[{ value: '', label: 'Все счета' }, ...accounts.map((account) => ({ value: account, label: maskAccount(account) }))]}
            />
          </label>
          <label className="is-wide"><span>Тип операции</span>
            <ChipSelect
              ariaLabel="Тип операции" active={Boolean(filters.opType)}
              value={filters.opType ?? ''} onChange={(value) => setField('opType', value)}
              options={[{ value: '', label: 'Все типы' }, ...opTypes.map((opType) => ({ value: opType, label: opType }))]}
            />
          </label>
          {extraActive && (
            <button type="button" className="link-btn" onClick={() => {
              setField('minAmount'); setField('maxAmount'); setField('account'); setField('opType')
            }}>
              Сбросить
            </button>
          )}
        </div>
      )}

      {visible.length === 0 && (
        <p className="list-empty">{transactions.length === 0 ? 'Операций пока нет — загрузи выгрузку на вкладке «Импорт».' : 'Ничего не нашлось — попробуй ослабить фильтры.'}</p>
      )}

      {groups.map((group, index) => (
        <section key={`${group.date}-${index}`} className="tx-day">
          <div className="tx-day-head">
            <span className="caps">{formatDayLong(group.date)}</span>
            <span className="amount">{dayTotal(group)}</span>
          </div>
          <div className="tx-list">
            {group.items.map((tx) => (
              <TxRow key={tx.key} tx={tx} categories={categories} onAssign={assign} />
            ))}
          </div>
        </section>
      ))}

      {remaining > 0 && (
        <button type="button" className="more-btn" onClick={() => setLimit((current) => current + PAGE)}>
          Показать ещё {Math.min(PAGE, remaining)}
          {remaining > PAGE ? ` из ${remaining}` : ''}
        </button>
      )}

      {sheet}
    </>
  )
}
