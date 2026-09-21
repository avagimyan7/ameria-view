import { formatAmount } from '../import/money.js'

export function formatAmd(luma) {
  return `${formatAmount(luma)} ֏`
}

// Банк не даёт курсов, поэтому суммы разных валют никогда не складываются —
// но их подписи обязаны отличаться, иначе доллар выглядит как драм.
// AMD (и неизвестная/неуказанная валюта) сохраняет привычный знак ֏,
// любая другая валюта подписывается своим кодом (например, «50 USD»).
export function formatMoney(luma, currency) {
  return currency && currency !== 'AMD' ? `${formatAmount(luma)} ${currency}` : formatAmd(luma)
}

export function formatDate(iso) {
  if (!iso) return ''
  const [year, month, day] = iso.split('-')
  return `${day}.${month}.${year}`
}

export function formatMonth(month) {
  const names = ['январь', 'февраль', 'март', 'апрель', 'май', 'июнь', 'июль',
    'август', 'сентябрь', 'октябрь', 'ноябрь', 'декабрь']
  const [year, monthNumber] = month.split('-')
  return `${names[Number(monthNumber) - 1]} ${year}`
}

export function maskAccount(account) {
  return account.length > 8 ? `${account.slice(0, 4)}…${account.slice(-4)}` : account
}

// Форма существительного при числе по-русски. forms — [одна, несколько, много]:
// ['операция', 'операции', 'операций'] → 1 операция, 2–4 операции, 5+ операций,
// а 11–14 (и 111–114) — всегда «много». Для винительного падежа передаются
// свои формы: ['операцию', 'операции', 'операций'].
export function pluralRu(count, [one, few, many]) {
  const lastTwo = Math.abs(count) % 100
  const last = lastTwo % 10
  if (lastTwo >= 11 && lastTwo <= 14) return many
  if (last === 1) return one
  if (last >= 2 && last <= 4) return few
  return many
}

// Сумма со знаком, как в макете: настоящий минус «−» (U+2212), а не дефис,
// и «+» у поступлений. sign: 'minus' | 'plus' | null — знак задаёт смысл
// операции (направление), а не знак числа: суммы в выписке всегда положительные.
export function formatSigned(luma, currency, sign) {
  const text = formatMoney(Math.abs(luma), currency)
  if (sign === 'minus') return `−${text}`
  if (sign === 'plus') return `+${text}`
  return text
}

// «18.09» — день и месяц без года, для списков внутри одного периода.
export function formatDayMonth(iso) {
  if (!iso) return ''
  const [, month, day] = iso.split('-')
  return `${day}.${month}`
}
