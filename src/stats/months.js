// Месяцы для переключателя и графика. На вход — строки byMonth(), в которых есть
// только месяцы с операциями: переключатель ходит по ним, а не по календарю,
// иначе «назад» то и дело приводило бы в пустой месяц.

export function neighbours(months, active) {
  const index = months.findIndex((row) => row.month === active)
  if (index === -1) return { prev: null, next: null }
  return {
    prev: months[index - 1]?.month ?? null,
    next: months[index + 1]?.month ?? null,
  }
}

// На узком экране больше полудюжины пар столбиков не помещается. Окно — последние
// месяцы, а если выбран давний, окно сдвигается так, чтобы он был виден.
export function chartWindow(months, active, size = 6) {
  const index = months.findIndex((row) => row.month === active)
  if (index === -1 || index >= months.length - size) return months.slice(-size)
  // Выбранный месяц — не у самого края: справа остаётся ещё один для сравнения.
  const end = Math.min(months.length, index + 2)
  const start = Math.max(0, end - size)
  return months.slice(start, start + size)
}

const SERVICE_CATEGORIES = ['fees', 'loan_principal', 'loan_interest']

// Какая доля расходов месяца ушла банку: комиссии и кредит (тело с процентами).
export function serviceShare(expenseRows) {
  const total = expenseRows.reduce((sum, row) => sum + row.amount, 0)
  if (total === 0) return null
  const service = expenseRows
    .filter((row) => SERVICE_CATEGORIES.includes(row.categoryId))
    .reduce((sum, row) => sum + row.amount, 0)
  return service / total
}
