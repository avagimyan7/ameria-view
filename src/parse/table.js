import { HEADERS } from '../domain/constants.js'

const MAX_HEADER_SCAN = 30
const FIELDS = Object.keys(HEADERS)

function matchHeaderRow(cells) {
  const byTitle = new Map()
  for (const [column, value] of Object.entries(cells)) {
    byTitle.set(String(value).trim(), column)
  }
  const columns = {}
  const missing = []
  for (const field of FIELDS) {
    const column = byTitle.get(HEADERS[field])
    if (column) columns[field] = column
    else missing.push(HEADERS[field])
  }
  return { columns, missing }
}

export function toNamedRows(sheetRows) {
  let headerIndex = -1
  let columns = null
  let lastMissing = FIELDS.map((field) => HEADERS[field])

  const limit = Math.min(sheetRows.length, MAX_HEADER_SCAN)
  for (let i = 0; i < limit; i += 1) {
    const { columns: found, missing } = matchHeaderRow(sheetRows[i].cells)
    if (missing.length === 0) {
      headerIndex = i
      columns = found
      break
    }
    if (missing.length < lastMissing.length) lastMissing = missing
  }

  if (headerIndex === -1) {
    throw new Error(
      `В первых ${limit} строках файла не найдена строка заголовков. ` +
        `Не хватает колонок: ${lastMissing.join(', ')}`,
    )
  }

  const rows = []
  for (let i = headerIndex + 1; i < sheetRows.length; i += 1) {
    const { cells } = sheetRows[i]
    if (!cells[columns.date]) break
    const row = {}
    for (const field of FIELDS) row[field] = cells[columns[field]] ?? ''
    rows.push(row)
  }
  return rows
}
