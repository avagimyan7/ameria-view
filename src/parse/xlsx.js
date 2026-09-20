import { unzipSync, strFromU8 } from 'fflate'

const DEFAULT_SHEET = 'xl/worksheets/sheet1.xml'

function pickSheetPath(files) {
  if (files[DEFAULT_SHEET]) return DEFAULT_SHEET
  const found = Object.keys(files).find((path) => /^xl\/worksheets\/.+\.xml$/.test(path))
  if (!found) throw new Error('В файле не найден лист Excel (xl/worksheets/*.xml)')
  return found
}

function parseXml(text) {
  const doc = new DOMParser().parseFromString(text, 'application/xml')
  const error = doc.getElementsByTagName('parsererror')[0]
  if (error) throw new Error(`Не удалось разобрать XML файла: ${error.textContent.trim()}`)
  return doc
}

function readSharedStrings(files) {
  const raw = files['xl/sharedStrings.xml']
  if (!raw) return []
  return Array.from(parseXml(strFromU8(raw)).getElementsByTagName('si')).map(
    (si) => si.textContent ?? '',
  )
}

export function readSheetRows(bytes) {
  const input = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes)
  const files = unzipSync(input)
  const shared = readSharedStrings(files)
  const doc = parseXml(strFromU8(files[pickSheetPath(files)]))

  return Array.from(doc.getElementsByTagName('row')).map((rowEl) => {
    const cells = {}
    for (const cellEl of Array.from(rowEl.getElementsByTagName('c'))) {
      const column = (cellEl.getAttribute('r') || '').replace(/\d+/g, '')
      const type = cellEl.getAttribute('t')
      let value
      if (type === 'inlineStr') {
        value = cellEl.getElementsByTagName('is')[0]?.textContent ?? ''
      } else {
        const raw = cellEl.getElementsByTagName('v')[0]?.textContent ?? ''
        value = type === 's' ? (shared[Number(raw)] ?? '') : raw
      }
      if (column && value !== '') cells[column] = value
    }
    return { row: Number(rowEl.getAttribute('r')) || 0, cells }
  })
}
