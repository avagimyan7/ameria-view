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
