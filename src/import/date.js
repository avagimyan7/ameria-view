export function parseDate(raw) {
  const match = /^(\d{2})-(\d{2})-(\d{4})$/.exec(String(raw ?? '').trim())
  if (!match) throw new Error(`Не удалось разобрать дату: ${JSON.stringify(raw)}`)
  const [, day, month, year] = match
  const iso = `${year}-${month}-${day}`
  const parsed = new Date(`${iso}T00:00:00Z`)
  if (Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== iso) {
    throw new Error(`Не удалось разобрать дату: ${JSON.stringify(raw)}`)
  }
  return iso
}

export function monthOf(iso) {
  return String(iso).slice(0, 7)
}

// Сегодняшняя дата в ISO по местному времени. toISOString() даёт дату в UTC:
// в Ереване (UTC+4) до 04:00 это ещё вчера, и прогноз бюджета в первый день
// месяца считал бы, что месяц не начался.
export function localIsoDate(date = new Date()) {
  const pad = (value) => String(value).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}
