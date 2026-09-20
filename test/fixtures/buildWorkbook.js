import { zipSync, strToU8 } from 'fflate'

const NS_MAIN = 'http://schemas.openxmlformats.org/spreadsheetml/2006/main'
const NS_REL = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships'
const NS_PKG_REL = 'http://schemas.openxmlformats.org/package/2006/relationships'
const NS_CT = 'http://schemas.openxmlformats.org/package/2006/content-types'

const esc = (value) =>
  String(value).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

function columnName(index) {
  let name = ''
  let n = index + 1
  while (n > 0) {
    name = String.fromCharCode(65 + ((n - 1) % 26)) + name
    n = Math.floor((n - 1) / 26)
  }
  return name
}

export function buildWorkbook(rows) {
  const shared = []
  const sharedIndex = new Map()
  const intern = (value) => {
    if (!sharedIndex.has(value)) {
      sharedIndex.set(value, shared.length)
      shared.push(value)
    }
    return sharedIndex.get(value)
  }

  const sheetRows = rows
    .map((cells, rowIndex) => {
      const body = cells
        .map((value, colIndex) => {
          if (value === null || value === undefined || value === '') return ''
          const ref = `${columnName(colIndex)}${rowIndex + 1}`
          if (typeof value === 'number') return `<c r="${ref}"><v>${value}</v></c>`
          return `<c r="${ref}" t="s"><v>${intern(String(value))}</v></c>`
        })
        .join('')
      return `<row r="${rowIndex + 1}">${body}</row>`
    })
    .join('')

  const files = {
    '[Content_Types].xml':
      `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
      `<Types xmlns="${NS_CT}">` +
      `<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>` +
      `<Default Extension="xml" ContentType="application/xml"/>` +
      `<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>` +
      `<Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>` +
      `<Override PartName="/xl/sharedStrings.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sharedStrings+xml"/>` +
      `</Types>`,
    '_rels/.rels':
      `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
      `<Relationships xmlns="${NS_PKG_REL}">` +
      `<Relationship Id="rId1" Type="${NS_REL}/officeDocument" Target="xl/workbook.xml"/>` +
      `</Relationships>`,
    'xl/workbook.xml':
      `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
      `<workbook xmlns="${NS_MAIN}" xmlns:r="${NS_REL}">` +
      `<sheets><sheet name="Sheet1" sheetId="1" r:id="rId1"/></sheets>` +
      `</workbook>`,
    'xl/_rels/workbook.xml.rels':
      `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
      `<Relationships xmlns="${NS_PKG_REL}">` +
      `<Relationship Id="rId1" Type="${NS_REL}/worksheet" Target="worksheets/sheet1.xml"/>` +
      `<Relationship Id="rId2" Type="${NS_REL}/sharedStrings" Target="sharedStrings.xml"/>` +
      `</Relationships>`,
    'xl/worksheets/sheet1.xml':
      `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
      `<worksheet xmlns="${NS_MAIN}"><sheetData>${sheetRows}</sheetData></worksheet>`,
    'xl/sharedStrings.xml':
      `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
      `<sst xmlns="${NS_MAIN}" count="${shared.length}" uniqueCount="${shared.length}">` +
      shared.map((value) => `<si><t>${esc(value)}</t></si>`).join('') +
      `</sst>`,
  }

  const zipInput = {}
  for (const [path, xml] of Object.entries(files)) zipInput[path] = strToU8(xml)
  return zipSync(zipInput)
}
