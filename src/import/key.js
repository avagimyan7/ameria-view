// docNo (Փաստ N) сознательно не входит в ключ: в реальной выгрузке это
// одно и то же значение во всех строках файла.
const KEY_FIELDS = [
  'date', 'opType', 'fromAccount', 'toAccount', 'counterparty',
  'details', 'comment', 'amount', 'currency',
]

const SEPARATOR = '\u0001'

export function buildKey(tx) {
  return KEY_FIELDS.map((field) => String(tx[field] ?? '')).join(SEPARATOR)
}

// Одинаковые строки внутри одного файла нумеруются по порядку, поэтому
// два настоящих одинаковых перевода в один день остаются двумя операциями,
// а повторная загрузка того же файла даёт те же самые ключи.
export function assignKeys(transactions) {
  const seen = new Map()
  return transactions.map((tx) => {
    const base = buildKey(tx)
    const occurrence = (seen.get(base) ?? 0) + 1
    seen.set(base, occurrence)
    return { ...tx, key: `${base}${SEPARATOR}#${occurrence}` }
  })
}

// На совпадающем ключе побеждает входящая копия. Поля ключа у двух копий
// одинаковы по определению; различаться могут только статус (операция была
// в ожидании, а теперь подтверждена) и производные direction и categoryId,
// которые приложение всё равно пересчитывает из настроек. Сохранённая копия
// не несёт ничего невосстановимого: ручные категории лежат в settings.overrides.
export function mergeTransactions(existing, incoming) {
  const byKey = new Map(existing.map((tx) => [tx.key, tx]))
  let added = 0
  let duplicates = 0
  for (const tx of incoming) {
    if (byKey.has(tx.key)) duplicates += 1
    else added += 1
    byKey.set(tx.key, tx)
  }
  const merged = Array.from(byKey.values()).sort((a, b) =>
    a.date === b.date ? a.key.localeCompare(b.key) : a.date.localeCompare(b.date),
  )
  return { merged, added, duplicates }
}
