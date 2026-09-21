import { useMemo, useState } from 'react'
import { totals, byMonth, byCategory, countable } from '../stats/aggregate.js'
import { neighbours, serviceShare } from '../stats/months.js'
import { monthOf, localIsoDate } from '../import/date.js'
import { MonthBars, MonthBarsPlaceholder } from './charts/MonthBars.jsx'
import { ScreenHeader } from './Layout.jsx'
import { ArrowDown, ArrowUp, ChevronLeft, ChevronRight, EmptyChart, Info } from './Icons.jsx'
import { formatDayMonth, formatMoney, formatMonth, formatSigned, pluralRu } from './format.js'

// Сколько категорий показывать на телефоне до кнопки «Ещё».
const VISIBLE_CATEGORIES = 8

export function MonthSwitcher({ months, active, onChange }) {
  const { prev, next } = neighbours(months, active)
  return (
    <div className="month-switch">
      <button
        type="button" className="month-switch-arrow" aria-label="Предыдущий месяц"
        disabled={!prev} onClick={() => onChange(prev)}
      >
        <ChevronLeft />
      </button>
      <h2 className="month-switch-label">{active ? formatMonth(active) : ''}</h2>
      <button
        type="button" className="month-switch-arrow" aria-label="Следующий месяц"
        disabled={!next} onClick={() => onChange(next)}
      >
        <ChevronRight />
      </button>
    </div>
  )
}

function lastMonths(count) {
  const [year, month] = localIsoDate().split('-').map(Number)
  return Array.from({ length: count }, (_, i) => {
    const date = new Date(year, month - 1 - (count - 1 - i), 1)
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
  })
}

function EmptyOverview({ loaded, onNavigate }) {
  return (
    <>
      <ScreenHeader title="Обзор" />
      <div className="empty-state">
        <div className="empty-state-icon"><EmptyChart /></div>
        {loaded ? (
          <>
            <h2>Пока нет данных</h2>
            <p>Загрузи выгрузку из myAmeria — и увидишь, сколько пришло, сколько ушло и куда именно.</p>
            <button type="button" className="btn btn-primary" onClick={() => onNavigate?.('import')}>
              Импортировать операции
            </button>
            <button type="button" className="more-btn" onClick={() => onNavigate?.('import')}>
              Как получить файл
            </button>
          </>
        ) : (
          <p>Загружаю сохранённые операции…</p>
        )}
      </div>
      <MonthBarsPlaceholder months={lastMonths(3)} />
    </>
  )
}

export function OverviewScreen({
  transactions, categories, currency = null, onNavigate, lastImport = null, loaded = true,
}) {
  const months = useMemo(() => byMonth(transactions, currency), [transactions, currency])
  const [selected, setSelected] = useState(null)
  const [showAll, setShowAll] = useState(false)
  // Выбор держится, только пока такой месяц есть в данных; иначе — последний месяц.
  const activeMonth = months.some((m) => m.month === selected) ? selected : months[months.length - 1]?.month ?? null

  const inMonth = useMemo(
    () => (activeMonth ? transactions.filter((tx) => monthOf(tx.date) === activeMonth) : []),
    [transactions, activeMonth],
  )

  if (countable(transactions, currency).length === 0) {
    return <EmptyOverview loaded={loaded} onNavigate={onNavigate} />
  }

  const monthTotals = totals(inMonth, currency)
  const counted = countable(inMonth, currency)
  const incomeCount = counted.filter((tx) => tx.direction === 'income').length
  const expenseCount = counted.length - incomeCount
  const expenses = byCategory(inMonth, 'expense', currency)
  const category = (id) => categories.find((c) => c.id === id)
  const nameOf = (id) => category(id)?.name ?? 'Без категории'
  const colourOf = (id) => category(id)?.color ?? 'var(--text-3)'
  const sumOf = (id) => expenses.find((row) => row.categoryId === id)?.amount ?? 0
  const share = serviceShare(expenses)
  const peak = Math.max(...expenses.map((row) => row.amount), 1)
  const turnover = monthTotals.income + monthTotals.expense
  const incomePart = turnover > 0 ? (monthTotals.income / turnover) * 100 : 50
  const net = monthTotals.net

  const subtitle = [
    `${counted.length} ${pluralRu(counted.length, ['операция', 'операции', 'операций'])} за месяц`,
    lastImport ? `последний импорт ${formatDayMonth(lastImport)}` : null,
  ].filter(Boolean).join(' · ')

  return (
    <>
      <ScreenHeader title="Обзор" subtitle={subtitle}>
        <MonthSwitcher months={months} active={activeMonth} onChange={setSelected} />
      </ScreenHeader>

      <div className="stack">
        <section className="summary">
          <div className="summary-net">
            <div className="summary-net-head">
              <span className="caps">Осталось</span>
              {net < 0 && <span className="badge badge-expense">перерасход</span>}
            </div>
            <div className={`summary-net-value amount${net < 0 ? ' expense' : ''}`} data-testid="total-net">
              {formatSigned(net, currency, net < 0 ? 'minus' : null)}
            </div>
            <div className="split-bar" aria-hidden="true">
              <span style={{ width: `${incomePart}%`, background: 'var(--income)' }} />
              <span style={{ width: `${100 - incomePart}%`, background: 'var(--expense)' }} />
            </div>
          </div>
          <div className="summary-tile is-income">
            <div className="summary-tile-label"><span className="income"><ArrowUp /></span>Пришло</div>
            <div className="summary-tile-value amount income" data-testid="total-income">
              {formatMoney(monthTotals.income, currency)}
            </div>
            <div className="summary-tile-count desktop-only">
              {incomeCount} {pluralRu(incomeCount, ['операция', 'операции', 'операций'])}
            </div>
          </div>
          <div className="summary-tile is-expense">
            <div className="summary-tile-label"><span className="expense"><ArrowDown /></span>Ушло</div>
            <div className="summary-tile-value amount expense" data-testid="total-expense">
              {formatMoney(monthTotals.expense, currency)}
            </div>
            <div className="summary-tile-count desktop-only">
              {expenseCount} {pluralRu(expenseCount, ['операция', 'операции', 'операций'])}
            </div>
          </div>
        </section>

        <div className="overview-middle">
          <MonthBars months={months} selected={activeMonth} onSelect={setSelected} />

          <div className="card">
            <div className="card-head" style={{ justifyContent: 'flex-start', gap: 8 }}>
              <span className="accent" style={{ display: 'flex' }}><Info /></span>
              <div className="card-title">То, что обычно не замечают</div>
            </div>
            <div className="rows">
              <div className="row kv">
                <span>Комиссии банка</span>
                <strong className="amount" data-testid="fees-total">{formatMoney(sumOf('fees'), currency)}</strong>
              </div>
              <div className="row kv">
                <span>Кредит с процентами</span>
                <strong className="amount" data-testid="loan-total">
                  {formatMoney(sumOf('loan_principal') + sumOf('loan_interest'), currency)}
                </strong>
              </div>
              {share !== null && share > 0 && (
                <p className="kv-note">
                  {(share * 100).toLocaleString('ru-RU', { maximumFractionDigits: 1 })}% всех расходов месяца
                  ушло на кредит и комиссии банка.
                </p>
              )}
            </div>
          </div>
        </div>

        <div className="card">
          <div className="card-head">
            <div className="card-title">Куда ушли деньги</div>
            {onNavigate && (
              <button type="button" className="link-btn" onClick={() => onNavigate('categories')}>
                <span className="mobile-only">Все →</span>
                <span className="desktop-only">Все категории →</span>
              </button>
            )}
          </div>
          <div className={`spend-list rows${showAll ? '' : ' is-collapsed'}`}>
            {expenses.map((row, index) => (
              <div
                key={row.categoryId ?? 'none'}
                className={`row spend-row${index >= VISIBLE_CATEGORIES ? ' is-extra' : ''}`}
              >
                <span className="dot" style={{ background: colourOf(row.categoryId) }} />
                <span className="spend-name">{nameOf(row.categoryId)}</span>
                <span className="bar spend-bar desktop-only" aria-hidden="true">
                  <span style={{ width: `${(row.amount / peak) * 100}%`, background: colourOf(row.categoryId) }} />
                </span>
                <span className="count-pill">{row.count}</span>
                <span className="spend-amount amount">{formatMoney(row.amount, currency)}</span>
              </div>
            ))}
          </div>
          {!showAll && expenses.length > VISIBLE_CATEGORIES && (
            <button type="button" className="more-btn mobile-only rows-foot" onClick={() => setShowAll(true)}>
              Ещё {expenses.length - VISIBLE_CATEGORIES}{' '}
              {pluralRu(expenses.length - VISIBLE_CATEGORIES, ['категория', 'категории', 'категорий'])}
            </button>
          )}
        </div>
      </div>
    </>
  )
}
