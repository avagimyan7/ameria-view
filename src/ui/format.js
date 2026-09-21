import { formatAmount } from '../import/money.js'

export function formatAmd(luma) {
  return `${formatAmount(luma)} ֏`
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
