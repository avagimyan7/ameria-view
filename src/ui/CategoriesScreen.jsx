import { useMemo, useState } from 'react'
import { byCategory, byMonth, uncategorized } from '../stats/aggregate.js'
import { budgetProgress } from '../stats/budget.js'
import { monthOf } from '../import/date.js'
import { CategoryBars } from './charts/CategoryBars.jsx'
import { ScreenHeader } from './Layout.jsx'
import { formatMoney, formatMonth, pluralRu } from './format.js'

// Бюджет — карточка: лимит, сколько потрачено, прогноз к концу месяца и бейдж
// состояния. Лимит храним в лумах, а вводят его в драмах — и цифры бюджета
// показываем в целых драмах: копейки в прогнозе ничего не говорят, а на узком
// экране из-за них сумма не помещается в треть карточки.
const whole = (luma) => Math.round(luma / 100) * 100

function BudgetCard({ category, limit, spent, projected, overrunDay, currency, onChangeBudget }) {
  const hasLimit = limit > 0
  const over = hasLimit && spent > limit
  const status = over
    ? { className: 'badge badge-expense', text: `перерасход ${formatMoney(whole(spent - limit), currency)}` }
    : hasLimit && overrunDay
      ? { className: 'badge badge-accent', text: `превысит с ${overrunDay}-го` }
      : hasLimit
        ? { className: 'badge badge-income', text: 'в пределах' }
        : null
  // При перерасходе полоса заполнена целиком, а часть сверх лимита — красная.
  const limitMark = over ? (limit / spent) * 100 : null
  const fill = hasLimit ? Math.min(1, spent / limit) * 100 : 0

  return (
    <div className="tile budget">
      <div className="budget-head">
        <span className="dot" style={{ background: category.color }} />
        <span className="budget-name">{category.name}</span>
        <span className={status?.className ?? 'badge badge-plain'} data-testid={`budget-${category.id}-overrun`}>
          {status?.text ?? ''}
        </span>
        {!status && <span className="badge badge-plain">лимит не задан</span>}
      </div>
      <div className="budget-fields">
        <label>
          <span>Лимит, ֏</span>
          <input
            className="field"
            data-testid={`budget-${category.id}-limit`}
            type="number" inputMode="numeric" min="0"
            value={Math.round(limit / 100)}
            onChange={(event) => {
              const value = Math.max(0, Number(event.target.value))
              onChangeBudget(category.id, Math.round(value * 100))
            }}
          />
        </label>
        <div>
          <span>Потрачено</span>
          <strong className={`amount${spent === 0 ? ' muted' : ''}`} data-testid={`budget-${category.id}-spent`}>
            {formatMoney(whole(spent), currency)}
          </strong>
        </div>
        <div>
          <span>Прогноз</span>
          <strong
            className={`amount${hasLimit && projected > limit ? ' expense' : ''}`}
            data-testid={`budget-${category.id}-projected`}
          >
            {hasLimit ? formatMoney(whole(projected), currency) : ''}
          </strong>
          {!hasLimit && <strong className="muted">—</strong>}
        </div>
      </div>
      {hasLimit && (
        <div className="bar budget-bar" aria-hidden="true">
          <span
            style={{
              width: `${over ? 100 : fill}%`,
              background: over
                ? `linear-gradient(90deg, ${category.color} 0%, ${category.color} ${limitMark}%, var(--expense) ${limitMark}%)`
                : category.color,
              borderRadius: over ? 0 : undefined,
            }}
          />
        </div>
      )}
    </div>
  )
}

export function CategoriesScreen({
  transactions, categories, budgets, month, today, onChangeBudget, onShowUncategorized, currency = null,
}) {
  const months = useMemo(() => byMonth(transactions, currency).map((row) => row.month), [transactions, currency])
  const [selected, setSelected] = useState(null)
  const [showAllBudgets, setShowAllBudgets] = useState(false)
  // Выбор держится, пока такой месяц есть в данных; иначе — месяц по умолчанию.
  const activeMonth = months.includes(selected) ? selected : month
  const monthOptions = months.includes(month) ? months : [...months, month]

  const inMonth = useMemo(
    () => transactions.filter((tx) => monthOf(tx.date) === activeMonth),
    [transactions, activeMonth],
  )
  const rows = byCategory(inMonth, 'expense', currency)
  const monthTotal = rows.reduce((sum, row) => sum + row.amount, 0)
  const pending = uncategorized(transactions, currency)
  const pendingAmount = pending.reduce((acc, tx) => acc + tx.amount, 0)
  const progress = budgetProgress(transactions, budgets, activeMonth, today, currency)
  const spentOf = (id) => rows.find((row) => row.categoryId === id)?.amount ?? 0

  // На виду — категории с лимитом; пока лимитов меньше трёх, к ним добавляются
  // самые затратные категории месяца. Остальные — под «Ещё», как в макете.
  const limited = categories.filter((c) => (budgets[c.id] ?? 0) > 0)
  const topSpending = [...categories]
    .filter((c) => !limited.includes(c) && spentOf(c.id) > 0)
    .sort((a, b) => spentOf(b.id) - spentOf(a.id))
    .slice(0, Math.max(0, 3 - limited.length))
  const active = categories.filter((c) => limited.includes(c) || topSpending.includes(c))
  const idle = categories.filter((c) => !active.includes(c))
  const shown = showAllBudgets ? [...active, ...idle] : active

  return (
    <>
      <ScreenHeader title="Категории">
        <select
          className="chip chip-strong"
          aria-label="Месяц"
          value={activeMonth}
          onChange={(event) => setSelected(event.target.value)}
        >
          {[...monthOptions].reverse().map((value) => (
            <option key={value} value={value}>{formatMonth(value)}</option>
          ))}
        </select>
      </ScreenHeader>

      <div className="stack">
        <div className="card">
          <div data-testid="categories-heading" style={{ marginBottom: 16 }}>
            <div className="card-title">Расходы по категориям</div>
            <div className="card-sub">
              {rows.length > 0
                ? `${formatMoney(monthTotal, currency)} за ${formatMonth(activeMonth)} · ${rows.length} ${pluralRu(rows.length, ['категория', 'категории', 'категорий'])}`
                : `За ${formatMonth(activeMonth)} расходов нет`}
            </div>
          </div>
          <CategoryBars rows={rows} categories={categories} currency={currency} />
        </div>

        {pending.length > 0 && (
          <div className="card card-attention">
            {/* Полосы выше — за один месяц, а очередь — за всё время и вместе с доходами:
                её задача разобрать весь накопившийся хвост. Масштаб назван явно, чтобы
                два числа на одном экране не выглядели противоречием. */}
            <div className="card-title">Без категории</div>
            <p className="card-sub" data-testid="uncategorized-summary">
              За весь период, доходы и расходы вместе: {pending.length}{' '}
              {pluralRu(pending.length, ['операция', 'операции', 'операций'])}
              {' '}на {formatMoney(pendingAmount, currency)}. Начни с самых крупных —
              в них лежит почти весь неопознанный оборот.
            </p>
            <button type="button" className="btn btn-primary btn-block" style={{ marginTop: 14 }} onClick={onShowUncategorized}>
              Разобрать
            </button>
          </div>
        )}

        <div className="card">
          <div className="card-title">Бюджеты</div>
          <div className="card-sub" style={{ marginBottom: 16 }}>
            Лимит на месяц, потрачено, прогноз к концу месяца и перерасход.
          </div>
          <div className="budgets">
            {shown.map((category) => {
              const row = progress.find((item) => item.categoryId === category.id)
              return (
                <BudgetCard
                  key={category.id}
                  category={category}
                  limit={budgets[category.id] ?? 0}
                  spent={spentOf(category.id)}
                  projected={row?.projectedTotal ?? 0}
                  overrunDay={row?.overrunDay ?? null}
                  currency={currency}
                  onChangeBudget={onChangeBudget}
                />
              )
            })}
            {!showAllBudgets && idle.length > 0 && (
              <button type="button" className="more-btn" onClick={() => setShowAllBudgets(true)}>
                {active.length > 0 ? 'Ещё' : 'Показать'} {idle.length}{' '}
                {pluralRu(idle.length, ['категория', 'категории', 'категорий'])}
              </button>
            )}
          </div>
        </div>
      </div>
    </>
  )
}
