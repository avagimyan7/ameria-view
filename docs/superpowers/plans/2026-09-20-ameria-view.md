# ameria-view Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Локальное офлайн-приложение, которое разбирает выгрузку myAmeria History и показывает, сколько пришло, сколько ушло, куда уходят деньги и укладываюсь ли я в бюджет.

**Architecture:** Браузерное приложение без бэкенда. Вся расчётная логика — чистые функции в `parse/`, `import/`, `rules/`, `stats/`, тестируемые без браузера. Побочные эффекты (IndexedDB, DOM, файлы) заперты в `store/` и `ui/`. XLSX разбирается своим парсером на `fflate` + `DOMParser`.

**Tech Stack:** Vite, React 19, Vitest (окружение jsdom), fflate, fake-indexeddb (только тесты). Графики — свой SVG.

**Spec:** `docs/superpowers/specs/2026-09-20-ameria-view-design.md`

## Global Constraints

- **Приложение не делает ни одного сетевого запроса.** В коде `src/` не должно быть `fetch`, `XMLHttpRequest`, `WebSocket` и внешних URL. Это проверяемое свойство продукта.
- **Деньги — только целые числа в лумах** (1 AMD = 100 лумов). `parseFloat` к суммам не применяется нигде.
- **Зависимости приложения: только `react`, `react-dom`, `fflate`.** Никаких библиотек для Excel и графиков.
- **Заголовки колонок сравниваются после `trim()`** — в реальном файле `Ելքագրվող հաշիվ ` идёт с хвостовым пробелом.
- **`Փաստ N` не участвует в идентичности транзакции** — в реальном файле это константа во всех строках.
- **Выгрузки банка никогда не коммитятся** — `.gitignore` уже содержит `*.xls`, `*.xlsx`, `*.csv`, `/data/`.
- Node 20+. Тесты: `npx vitest run`.

## Контракты между модулями

Эти типы используются во всех задачах. Имена полей менять нельзя.

```js
// Строка файла после сопоставления с заголовками (parse/table.js). Все поля — сырые строки.
// { date, docNo, opType, fromAccount, toAccount, counterparty, details, status, comment, amount, currency }

// Транзакция (import/transactions.js)
// {
//   key: string,            // проставляется в import/key.js
//   date: string,           // 'YYYY-MM-DD'
//   opType: string,
//   fromAccount: string,
//   toAccount: string,
//   counterparty: string,
//   details: string,        // сырое, с обрезкой банка
//   comment: string,
//   status: string,
//   amount: number,         // целое, лумы
//   currency: string,
//   direction: 'expense' | 'income' | 'internal' | 'unresolved',
//   categoryId: string | null
// }

// Настройки (store/settings.js) — то, что уезжает в rules.json
// {
//   version: 1,
//   ownAccounts: string[],
//   categories: [{ id, name, color }],
//   rules: [{ match, category, direction?, opType? }],
//   overrides: { [txKey]: categoryId },
//   budgets: { [categoryId]: number }   // месячный лимит в лумах
// }
```

## Карта файлов

| Файл | Ответственность |
|---|---|
| `src/parse/xlsx.js` | распаковать ZIP, вернуть ячейки листа по буквам колонок |
| `src/parse/table.js` | найти строку заголовков по именам, отдать именованные строки |
| `src/domain/constants.js` | имена заголовков, типы операций, статус |
| `src/import/money.js` | сумма-строка → целые лумы |
| `src/import/date.js` | `DD-MM-YYYY` → ISO |
| `src/import/accounts.js` | автоопределение своих счетов |
| `src/import/transactions.js` | строки → транзакции, направление, статус |
| `src/import/key.js` | составной ключ, нумерация дублей, слияние |
| `src/rules/normalize.js` | нормализация имени мерчанта |
| `src/rules/match.js` | подбор категории с приоритетами |
| `src/rules/seed.js` | стартовые категории и правила |
| `src/stats/aggregate.js` | итоги, по месяцам, по категориям, по мерчантам |
| `src/stats/budget.js` | бюджеты: потрачено, доля, прогноз перерасхода |
| `src/store/db.js` | IndexedDB |
| `src/store/settings.js` | rules.json: сериализация, разбор, значения по умолчанию |
| `src/ui/*` | экраны |
| `test/fixtures/buildWorkbook.js` | строит XLSX в памяти для тестов |
| `tools/anonymize.mjs` | обезличивает реальную выгрузку в фикстуру |

---

### Task 1: Каркас проекта и построитель тестовых XLSX

**Files:**
- Create: `package.json`, `vite.config.js`, `index.html`, `src/main.jsx`, `src/App.jsx`
- Create: `test/fixtures/buildWorkbook.js`
- Test: `test/fixtures/buildWorkbook.test.js`

**Interfaces:**
- Consumes: ничего
- Produces: `buildWorkbook(rows: Array<Array<string|number|null>>) => Uint8Array` — байты XLSX с `sharedStrings`, ровно в той форме, в какой их отдаёт банк. Используется всеми тестами парсера.

- [ ] **Step 1: Создать `package.json` и поставить зависимости**

```json
{
  "name": "ameria-view",
  "private": true,
  "version": "1.0.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "preview": "vite preview",
    "test": "vitest run",
    "test:watch": "vitest"
  },
  "dependencies": {
    "react": "^19.2.8",
    "react-dom": "^19.2.8",
    "fflate": "^0.8.2"
  },
  "devDependencies": {
    "@testing-library/dom": "^10.4.0",
    "@testing-library/react": "^16.3.0",
    "@vitejs/plugin-react": "^6.0.4",
    "fake-indexeddb": "^6.0.0",
    "jsdom": "^29.1.1",
    "vite": "^8.1.5",
    "vitest": "^4.1.10"
  }
}
```

Run: `npm install`

- [ ] **Step 2: Создать каркас приложения**

`vite.config.js`:

```js
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    include: ['src/**/*.test.{js,jsx}', 'test/**/*.test.{js,jsx}'],
  },
})
```

`index.html`:

```html
<!doctype html>
<html lang="ru">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>ameria-view</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.jsx"></script>
  </body>
</html>
```

`src/main.jsx`:

```jsx
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App.jsx'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
```

`src/App.jsx`:

```jsx
export default function App() {
  return <main>ameria-view</main>
}
```

- [ ] **Step 3: Написать падающий тест построителя**

`test/fixtures/buildWorkbook.test.js`:

```js
import { describe, it, expect } from 'vitest'
import { unzipSync, strFromU8 } from 'fflate'
import { buildWorkbook } from './buildWorkbook.js'

describe('buildWorkbook', () => {
  it('создаёт ZIP с листом и таблицей общих строк', () => {
    const bytes = buildWorkbook([['Ամսաթիվ', 'Գումար'], ['19-09-2026', '3000.0']])
    const files = unzipSync(bytes)

    expect(Object.keys(files)).toEqual(
      expect.arrayContaining([
        '[Content_Types].xml',
        '_rels/.rels',
        'xl/workbook.xml',
        'xl/_rels/workbook.xml.rels',
        'xl/worksheets/sheet1.xml',
        'xl/sharedStrings.xml',
      ]),
    )

    const sheet = strFromU8(files['xl/worksheets/sheet1.xml'])
    expect(sheet).toContain('<row r="1">')
    expect(sheet).toContain('r="A2"')

    const shared = strFromU8(files['xl/sharedStrings.xml'])
    expect(shared).toContain('Ամսաթիվ')
    expect(shared).toContain('19-09-2026')
  })

  it('пропускает пустые ячейки, сохраняя буквы колонок', () => {
    const bytes = buildWorkbook([['A', null, 'C']])
    const sheet = strFromU8(unzipSync(bytes)['xl/worksheets/sheet1.xml'])
    expect(sheet).toContain('r="A1"')
    expect(sheet).not.toContain('r="B1"')
    expect(sheet).toContain('r="C1"')
  })

  it('экранирует спецсимволы XML', () => {
    const bytes = buildWorkbook([['Ա & Բ <тест>']])
    const shared = strFromU8(unzipSync(bytes)['xl/sharedStrings.xml'])
    expect(shared).toContain('Ա &amp; Բ &lt;тест&gt;')
  })
})
```

- [ ] **Step 4: Запустить тест и убедиться, что он падает**

Run: `npx vitest run test/fixtures/buildWorkbook.test.js`
Expected: FAIL — `Failed to resolve import "./buildWorkbook.js"`

- [ ] **Step 5: Реализовать построитель**

`test/fixtures/buildWorkbook.js`:

```js
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
```

- [ ] **Step 6: Запустить тесты — должны пройти**

Run: `npx vitest run test/fixtures/buildWorkbook.test.js`
Expected: PASS, 3 теста

- [ ] **Step 7: Коммит**

```bash
git add package.json package-lock.json vite.config.js index.html src test
git commit -m "Добавить каркас проекта и построитель тестовых XLSX"
```

---

### Task 2: Чтение ячеек XLSX

**Files:**
- Create: `src/parse/xlsx.js`
- Test: `src/parse/xlsx.test.js`

**Interfaces:**
- Consumes: `buildWorkbook(rows)` из Task 1
- Produces: `readSheetRows(bytes: Uint8Array|ArrayBuffer) => Array<{ row: number, cells: Record<string, string> }>` — строки листа в порядке документа; `cells` ключуется буквой колонки (`'A'`, `'B'`, …), пустые ячейки отсутствуют.

- [ ] **Step 1: Написать падающий тест**

`src/parse/xlsx.test.js`:

```js
import { describe, it, expect } from 'vitest'
import { buildWorkbook } from '../../test/fixtures/buildWorkbook.js'
import { readSheetRows } from './xlsx.js'

describe('readSheetRows', () => {
  it('читает строковые ячейки через таблицу общих строк', () => {
    const rows = readSheetRows(buildWorkbook([['Ամսաթիվ', 'Գումար'], ['19-09-2026', '3000.0']]))
    expect(rows).toHaveLength(2)
    expect(rows[0].cells).toEqual({ A: 'Ամսաթիվ', B: 'Գումար' })
    expect(rows[1].cells).toEqual({ A: '19-09-2026', B: '3000.0' })
  })

  it('читает числовые ячейки без атрибута типа', () => {
    const rows = readSheetRows(buildWorkbook([[42, 'AMD']]))
    expect(rows[0].cells.A).toBe('42')
    expect(rows[0].cells.B).toBe('AMD')
  })

  it('не создаёт ключей для пустых ячеек и сохраняет буквы колонок', () => {
    const rows = readSheetRows(buildWorkbook([['A', null, 'C']]))
    expect(rows[0].cells).toEqual({ A: 'A', C: 'C' })
  })

  it('возвращает номер строки листа', () => {
    const rows = readSheetRows(buildWorkbook([['раз'], ['два']]))
    expect(rows.map((r) => r.row)).toEqual([1, 2])
  })

  it('внятно ругается, если листа нет', () => {
    const notAWorkbook = buildWorkbook([['x']])
    const broken = notAWorkbook.slice(0, 40)
    expect(() => readSheetRows(broken)).toThrow()
  })
})
```

- [ ] **Step 2: Запустить тест и убедиться, что он падает**

Run: `npx vitest run src/parse/xlsx.test.js`
Expected: FAIL — `Failed to resolve import "./xlsx.js"`

- [ ] **Step 3: Реализовать чтение**

`src/parse/xlsx.js`:

```js
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
```

- [ ] **Step 4: Запустить тесты — должны пройти**

Run: `npx vitest run src/parse/xlsx.test.js`
Expected: PASS, 5 тестов

- [ ] **Step 5: Коммит**

```bash
git add src/parse/xlsx.js src/parse/xlsx.test.js
git commit -m "Читать ячейки XLSX через fflate и DOMParser"
```

---

### Task 3: Поиск заголовков и именованные строки

Здесь живёт главная защита от тихой порчи данных: колонки сопоставляются **по именам заголовков**, а не по номерам. Если банк добавит строку в шапку или переставит колонки, разбор не должен молча поехать и начать считать номера счетов суммами.

**Files:**
- Create: `src/domain/constants.js`
- Create: `src/parse/table.js`
- Test: `src/parse/table.test.js`

**Interfaces:**
- Consumes: `readSheetRows(bytes)` из Task 2
- Produces:
  - `HEADERS` — объект `{ поле: 'армянский заголовок' }`
  - `OP` — константы типов операций, `STATUS_APPROVED`
  - `toNamedRows(sheetRows) => Array<NamedRow>`, где `NamedRow` = `{ date, docNo, opType, fromAccount, toAccount, counterparty, details, status, comment, amount, currency }`, все значения — сырые строки (отсутствующие → `''`)

- [ ] **Step 1: Создать константы предметной области**

`src/domain/constants.js`:

```js
// Заголовки колонок выгрузки myAmeria History.
// Сравниваются после trim(): в реальном файле 'Ելքագրվող հաշիվ ' идёт с хвостовым пробелом.
export const HEADERS = {
  date: 'Ամսաթիվ',
  docNo: 'Փաստ N',
  opType: 'ԳՏ',
  fromAccount: 'Ելքագրվող հաշիվ',
  toAccount: 'Շահառուի հաշիվ',
  counterparty: 'Վճարող/Շահառու',
  details: 'Մանրամասներ',
  status: 'Կարգավիճակ',
  comment: 'Մեկնաբանություն',
  amount: 'Գումար',
  currency: 'Արժույթ',
}

// Типы операций, которые банк проставляет сам в колонке ԳՏ.
export const OP = {
  CARD: 'Քարտային գործարք',
  TRANSFER_TO_CARD: 'Փոխանցում քարտին',
  TRANSFER_FEE: 'Փոխանցման միջնորդավճար',
  BETWEEN_OWN: 'Իմ հաշիվների միջև',
  TRANSFER_TO_ACCOUNT: 'Հաշվին փոխանցում',
  INTEREST_REPAY: 'Տոկոսի մարում',
  LOAN_REPAY: 'Վարկի մարում',
  DEPOSIT_TOPUP: 'Ավանդի համալրում',
  LOAN_ISSUE: 'Վարկի տրամադրում',
}

export const STATUS_APPROVED = 'Հաստատված'
```

- [ ] **Step 2: Написать падающий тест**

`src/parse/table.test.js`:

```js
import { describe, it, expect } from 'vitest'
import { buildWorkbook } from '../../test/fixtures/buildWorkbook.js'
import { readSheetRows } from './xlsx.js'
import { toNamedRows } from './table.js'
import { HEADERS } from '../domain/constants.js'

const HEADER_ROW = [
  HEADERS.date, HEADERS.docNo, HEADERS.opType, HEADERS.fromAccount, HEADERS.toAccount,
  HEADERS.counterparty, HEADERS.details, HEADERS.status, HEADERS.comment, HEADERS.amount,
  HEADERS.currency,
]

const DATA_ROW = [
  '19-09-2026', '31', 'Քարտային գործարք', '1570000000000001', '1570000000000002',
  'TEST COUNTERPARTY', 'Ք: ASK 23 LLC YEREVAN AM 887772', 'Հաստատված', '', '3000.0', 'AMD',
]

const named = (rows) => toNamedRows(readSheetRows(buildWorkbook(rows)))

describe('toNamedRows', () => {
  it('находит заголовки под многострочной шапкой банка', () => {
    const rows = named([
      ['логотип'], ['+374 10 56 11 11'], ['info@ameriabank.am'], ['Պատմություն'],
      ['TEST USER'], [], ['22-07-2026-20-09-2026'], HEADER_ROW, DATA_ROW,
    ])
    expect(rows).toHaveLength(1)
    expect(rows[0].details).toBe('Ք: ASK 23 LLC YEREVAN AM 887772')
    expect(rows[0].amount).toBe('3000.0')
  })

  it('сопоставляет колонки по именам, а не по позициям', () => {
    const swapped = [...HEADER_ROW]
    const swappedData = [...DATA_ROW]
    ;[swapped[9], swapped[10]] = [swapped[10], swapped[9]]
    ;[swappedData[9], swappedData[10]] = [swappedData[10], swappedData[9]]

    const rows = named([swapped, swappedData])
    expect(rows[0].amount).toBe('3000.0')
    expect(rows[0].currency).toBe('AMD')
  })

  it('терпит хвостовые пробелы в заголовках', () => {
    const padded = HEADER_ROW.map((h) => `${h} `)
    const rows = named([padded, DATA_ROW])
    expect(rows[0].fromAccount).toBe('1570000000000001')
  })

  it('останавливается на первой строке без даты', () => {
    const rows = named([HEADER_ROW, DATA_ROW, [], DATA_ROW])
    expect(rows).toHaveLength(1)
  })

  it('подставляет пустую строку для отсутствующих ячеек', () => {
    const rows = named([HEADER_ROW, DATA_ROW])
    expect(rows[0].comment).toBe('')
  })

  it('называет недостающие заголовки в тексте ошибки', () => {
    const broken = HEADER_ROW.filter((h) => h !== HEADERS.amount)
    expect(() => named([broken, DATA_ROW])).toThrow(/Գումար/)
  })
})
```

- [ ] **Step 3: Запустить тест и убедиться, что он падает**

Run: `npx vitest run src/parse/table.test.js`
Expected: FAIL — `Failed to resolve import "./table.js"`

- [ ] **Step 4: Реализовать сопоставление**

`src/parse/table.js`:

```js
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
```

- [ ] **Step 5: Запустить тесты — должны пройти**

Run: `npx vitest run src/parse/table.test.js`
Expected: PASS, 6 тестов

- [ ] **Step 6: Коммит**

```bash
git add src/domain/constants.js src/parse/table.js src/parse/table.test.js
git commit -m "Искать заголовки по именам колонок и отдавать именованные строки"
```

---

### Task 4: Разбор сумм и дат

Суммы — единственное место, где ошибка напрямую искажает ответ на вопрос «сколько ушло». Поэтому целые лумы и никакого `parseFloat`.

**Files:**
- Create: `src/import/money.js`, `src/import/date.js`
- Test: `src/import/money.test.js`, `src/import/date.test.js`

**Interfaces:**
- Consumes: ничего
- Produces:
  - `parseAmount(raw: string) => number` — целые лумы, бросает исключение на мусоре
  - `formatAmount(luma: number) => string` — для интерфейса, неразрывный пробел как разделитель тысяч
  - `parseDate(raw: string) => string` — `'19-09-2026'` → `'2026-09-19'`, бросает на некорректной дате
  - `monthOf(iso: string) => string` — `'2026-09-19'` → `'2026-09'`

- [ ] **Step 1: Написать падающие тесты**

`src/import/money.test.js`:

```js
import { describe, it, expect } from 'vitest'
import { parseAmount, formatAmount } from './money.js'

describe('parseAmount', () => {
  it('переводит суммы в целые лумы', () => {
    expect(parseAmount('3000.0')).toBe(300000)
    expect(parseAmount('9.0')).toBe(900)
    expect(parseAmount('0.01')).toBe(1)
    expect(parseAmount('1234')).toBe(123400)
  })

  it('не теряет точность на больших суммах', () => {
    expect(parseAmount('999999999.99')).toBe(99999999999)
  })

  it('принимает запятую как десятичный разделитель и пробелы в разрядах', () => {
    expect(parseAmount('1 234,56')).toBe(123456)
  })

  it('понимает отрицательные суммы', () => {
    expect(parseAmount('-50.25')).toBe(-5025)
  })

  it('бросает исключение на мусоре', () => {
    expect(() => parseAmount('не сумма')).toThrow(/Не удалось разобрать сумму/)
    expect(() => parseAmount('')).toThrow(/Не удалось разобрать сумму/)
  })
})

describe('formatAmount', () => {
  it('прячет нулевые копейки и разделяет разряды', () => {
    expect(formatAmount(300000)).toBe('3\u00A0000')
    expect(formatAmount(99999999999)).toBe('999\u00A0999\u00A0999,99')
    expect(formatAmount(-5025)).toBe('-50,25')
    expect(formatAmount(0)).toBe('0')
  })
})
```

`src/import/date.test.js`:

```js
import { describe, it, expect } from 'vitest'
import { parseDate, monthOf } from './date.js'

describe('parseDate', () => {
  it('переводит DD-MM-YYYY в ISO', () => {
    expect(parseDate('19-09-2026')).toBe('2026-09-19')
    expect(parseDate('01-01-2025')).toBe('2025-01-01')
  })

  it('бросает исключение на несуществующей дате', () => {
    expect(() => parseDate('32-01-2026')).toThrow(/дату/)
    expect(() => parseDate('29-02-2025')).toThrow(/дату/)
    expect(() => parseDate('2026-09-19')).toThrow(/дату/)
    expect(() => parseDate('')).toThrow(/дату/)
  })
})

describe('monthOf', () => {
  it('отрезает день', () => {
    expect(monthOf('2026-09-19')).toBe('2026-09')
  })
})
```

- [ ] **Step 2: Запустить тесты и убедиться, что они падают**

Run: `npx vitest run src/import/money.test.js src/import/date.test.js`
Expected: FAIL — модули не найдены

- [ ] **Step 3: Реализовать разбор сумм**

`src/import/money.js`:

```js
// Деньги хранятся целыми числами в лумах: 1 AMD = 100 лумов.
// parseFloat к суммам не применяется нигде — он даёт расхождения в итогах.
export function parseAmount(raw) {
  const text = String(raw ?? '').trim().replace(/\s/g, '').replace(',', '.')
  const match = /^(-?)(\d+)(?:\.(\d{1,2}))?$/.exec(text)
  if (!match) throw new Error(`Не удалось разобрать сумму: ${JSON.stringify(raw)}`)
  const [, sign, whole, fraction = ''] = match
  const luma = Number(whole) * 100 + Number(`${fraction}00`.slice(0, 2))
  return sign === '-' ? -luma : luma
}

export function formatAmount(luma) {
  const sign = luma < 0 ? '-' : ''
  const abs = Math.abs(luma)
  const whole = String(Math.floor(abs / 100)).replace(/\B(?=(\d{3})+(?!\d))/g, '\u00A0')
  const fraction = abs % 100
  return fraction === 0
    ? `${sign}${whole}`
    : `${sign}${whole},${String(fraction).padStart(2, '0')}`
}
```

- [ ] **Step 4: Реализовать разбор дат**

`src/import/date.js`:

```js
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
```

- [ ] **Step 5: Запустить тесты — должны пройти**

Run: `npx vitest run src/import/money.test.js src/import/date.test.js`
Expected: PASS, 11 тестов

- [ ] **Step 6: Коммит**

```bash
git add src/import/money.js src/import/money.test.js src/import/date.js src/import/date.test.js
git commit -m "Разбирать суммы в целые лумы и даты в ISO"
```

---

### Task 5: Автоопределение своих счетов

В файле нет пометки «это мой счёт», а без неё нельзя отличить доход от расхода. Засев берётся из того, что банк проставил сам.

**Files:**
- Create: `src/import/accounts.js`
- Test: `src/import/accounts.test.js`

**Interfaces:**
- Consumes: `OP` из `src/domain/constants.js`
- Produces: `detectOwnAccounts(namedRows) => string[]` — отсортированный уникальный список номеров счетов

- [ ] **Step 1: Написать падающий тест**

`src/import/accounts.test.js`:

```js
import { describe, it, expect } from 'vitest'
import { detectOwnAccounts } from './accounts.js'
import { OP } from '../domain/constants.js'

const row = (over) => ({
  date: '19-09-2026', docNo: '31', opType: OP.CARD, fromAccount: '', toAccount: '',
  counterparty: '', details: '', status: 'Հաստատված', comment: '', amount: '100.0',
  currency: 'AMD', ...over,
})

describe('detectOwnAccounts', () => {
  it('берёт оба счёта из переводов между своими счетами', () => {
    const found = detectOwnAccounts([
      row({ opType: OP.BETWEEN_OWN, fromAccount: 'A1', toAccount: 'A2' }),
    ])
    expect(found).toEqual(['A1', 'A2'])
  })

  it('добавляет счёт списания карточных операций', () => {
    const found = detectOwnAccounts([
      row({ opType: OP.CARD, fromAccount: 'CARD1', toAccount: 'SHOP' }),
    ])
    expect(found).toEqual(['CARD1'])
  })

  it('не считает своим счёт зачисления карточной операции', () => {
    const found = detectOwnAccounts([
      row({ opType: OP.CARD, fromAccount: 'CARD1', toAccount: 'SHOP' }),
    ])
    expect(found).not.toContain('SHOP')
  })

  it('игнорирует счета из прочих типов операций', () => {
    const found = detectOwnAccounts([
      row({ opType: OP.TRANSFER_TO_ACCOUNT, fromAccount: 'STRANGER', toAccount: 'OTHER' }),
    ])
    expect(found).toEqual([])
  })

  it('возвращает уникальный отсортированный список', () => {
    const found = detectOwnAccounts([
      row({ opType: OP.CARD, fromAccount: 'B' }),
      row({ opType: OP.CARD, fromAccount: 'A' }),
      row({ opType: OP.CARD, fromAccount: 'B' }),
    ])
    expect(found).toEqual(['A', 'B'])
  })
})
```

- [ ] **Step 2: Запустить тест и убедиться, что он падает**

Run: `npx vitest run src/import/accounts.test.js`
Expected: FAIL — `Failed to resolve import "./accounts.js"`

- [ ] **Step 3: Реализовать определение**

`src/import/accounts.js`:

```js
import { OP } from '../domain/constants.js'

// Засев: оба счёта из строк, которые банк сам пометил как перевод между своими
// счетами, плюс счета списания карточных операций (списать с чужой карты нельзя).
export function detectOwnAccounts(namedRows) {
  const own = new Set()
  for (const row of namedRows) {
    if (row.opType === OP.BETWEEN_OWN) {
      if (row.fromAccount) own.add(row.fromAccount)
      if (row.toAccount) own.add(row.toAccount)
    }
  }
  for (const row of namedRows) {
    if (row.opType === OP.CARD && row.fromAccount) own.add(row.fromAccount)
  }
  return Array.from(own).sort()
}
```

- [ ] **Step 4: Запустить тесты — должны пройти**

Run: `npx vitest run src/import/accounts.test.js`
Expected: PASS, 5 тестов

- [ ] **Step 5: Коммит**

```bash
git add src/import/accounts.js src/import/accounts.test.js
git commit -m "Определять свои счета по подсказкам банка"
```

---

### Task 6: Идентичность транзакции и дедупликация

Выгрузки грузятся внахлёст по датам, поэтому нужен ключ. `Փաստ N` в него не входит — в реальном файле это константа во всех строках.

**Files:**
- Create: `src/import/key.js`
- Test: `src/import/key.test.js`

**Interfaces:**
- Consumes: ничего
- Produces:
  - `buildKey(tx) => string` — по содержательным полям, без `docNo`
  - `assignKeys(transactions) => Transaction[]` — добавляет `key` с порядковым номером одинаковых строк (`…#1`, `…#2`)
  - `mergeTransactions(existing, incoming) => { merged, added, duplicates }` — `merged` отсортирован по дате, затем по ключу

- [ ] **Step 1: Написать падающий тест**

`src/import/key.test.js`:

```js
import { describe, it, expect } from 'vitest'
import { buildKey, assignKeys, mergeTransactions } from './key.js'

const tx = (over) => ({
  date: '2026-09-19', opType: 'Քարտային գործարք', fromAccount: 'A1', toAccount: 'SHOP',
  counterparty: 'ASK 23', details: 'Ք: ASK 23 LLC YEREVAN AM 887772', comment: '',
  status: 'Հաստատված', amount: 300000, currency: 'AMD', direction: 'expense',
  categoryId: null, ...over,
})

describe('buildKey', () => {
  it('не зависит от номера документа', () => {
    expect(buildKey({ ...tx(), docNo: '31' })).toBe(buildKey({ ...tx(), docNo: '999' }))
  })

  it('различает операции по сумме и по деталям', () => {
    expect(buildKey(tx())).not.toBe(buildKey(tx({ amount: 300001 })))
    expect(buildKey(tx())).not.toBe(buildKey(tx({ details: 'Ք: ASK 23 LLC YEREVAN AM 190677' })))
  })

  it('не путает операции из-за символа-разделителя в данных', () => {
    expect(buildKey(tx({ counterparty: 'A|B', details: 'C' })))
      .not.toBe(buildKey(tx({ counterparty: 'A', details: 'B|C' })))
  })
})

describe('assignKeys', () => {
  it('нумерует полностью одинаковые строки, не теряя вторую', () => {
    const [first, second] = assignKeys([tx(), tx()])
    expect(first.key).toMatch(/#1$/)
    expect(second.key).toMatch(/#2$/)
    expect(first.key).not.toBe(second.key)
  })

  it('воспроизводит нумерацию при повторном разборе того же файла', () => {
    const once = assignKeys([tx(), tx()]).map((t) => t.key)
    const twice = assignKeys([tx(), tx()]).map((t) => t.key)
    expect(twice).toEqual(once)
  })
})

describe('mergeTransactions', () => {
  it('повторная загрузка того же файла ничего не добавляет', () => {
    const batch = assignKeys([tx(), tx({ amount: 900 })])
    const { merged, added, duplicates } = mergeTransactions(batch, batch)
    expect(added).toBe(0)
    expect(duplicates).toBe(2)
    expect(merged).toHaveLength(2)
  })

  it('из пересекающегося периода берёт только новое', () => {
    const existing = assignKeys([tx({ date: '2026-09-01' }), tx({ date: '2026-09-10' })])
    const incoming = assignKeys([tx({ date: '2026-09-10' }), tx({ date: '2026-09-20' })])
    const { merged, added, duplicates } = mergeTransactions(existing, incoming)
    expect(added).toBe(1)
    expect(duplicates).toBe(1)
    expect(merged.map((t) => t.date)).toEqual(['2026-09-01', '2026-09-10', '2026-09-20'])
  })

  it('не затирает уже сохранённую операцию входящей копией', () => {
    const existing = assignKeys([tx({ categoryId: 'groceries' })])
    const incoming = assignKeys([tx()])
    const { merged } = mergeTransactions(existing, incoming)
    expect(merged[0].categoryId).toBe('groceries')
  })
})
```

- [ ] **Step 2: Запустить тест и убедиться, что он падает**

Run: `npx vitest run src/import/key.test.js`
Expected: FAIL — `Failed to resolve import "./key.js"`

- [ ] **Step 3: Реализовать ключи и слияние**

`src/import/key.js`:

```js
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

export function mergeTransactions(existing, incoming) {
  const byKey = new Map(existing.map((tx) => [tx.key, tx]))
  let added = 0
  let duplicates = 0
  for (const tx of incoming) {
    if (byKey.has(tx.key)) {
      duplicates += 1
    } else {
      byKey.set(tx.key, tx)
      added += 1
    }
  }
  const merged = Array.from(byKey.values()).sort((a, b) =>
    a.date === b.date ? a.key.localeCompare(b.key) : a.date.localeCompare(b.date),
  )
  return { merged, added, duplicates }
}
```

- [ ] **Step 4: Запустить тесты — должны пройти**

Run: `npx vitest run src/import/key.test.js`
Expected: PASS, 8 тестов

- [ ] **Step 5: Коммит**

```bash
git add src/import/key.js src/import/key.test.js
git commit -m "Дедуплицировать транзакции по составному ключу без номера документа"
```

---

### Task 7: Сборка транзакций и определение направления

**Files:**
- Create: `src/import/transactions.js`
- Test: `src/import/transactions.test.js`

**Interfaces:**
- Consumes: `parseAmount`, `parseDate`, `assignKeys`
- Produces: `toTransactions(namedRows, ownAccounts) => Transaction[]` — с проставленными `direction`, `key`, `categoryId: null`

- [ ] **Step 1: Написать падающий тест**

`src/import/transactions.test.js`:

```js
import { describe, it, expect } from 'vitest'
import { toTransactions } from './transactions.js'
import { OP } from '../domain/constants.js'

const row = (over) => ({
  date: '19-09-2026', docNo: '31', opType: OP.CARD, fromAccount: 'MINE1', toAccount: 'SHOP',
  counterparty: 'ASK 23', details: 'Ք: ASK 23 LLC YEREVAN AM 887772', status: 'Հաստատված',
  comment: '', amount: '3000.0', currency: 'AMD', ...over,
})

const own = ['MINE1', 'MINE2']

describe('toTransactions', () => {
  it('списание с моего счёта — это расход', () => {
    const [tx] = toTransactions([row()], own)
    expect(tx.direction).toBe('expense')
    expect(tx.amount).toBe(300000)
    expect(tx.date).toBe('2026-09-19')
  })

  it('зачисление на мой счёт — это доход', () => {
    const [tx] = toTransactions([row({ fromAccount: 'EMPLOYER', toAccount: 'MINE1' })], own)
    expect(tx.direction).toBe('income')
  })

  it('оба счёта мои — это внутренний перевод', () => {
    const [tx] = toTransactions([row({ fromAccount: 'MINE1', toAccount: 'MINE2' })], own)
    expect(tx.direction).toBe('internal')
  })

  it('ни один счёт не мой — операция помечается как требующая внимания, а не угадывается', () => {
    const [tx] = toTransactions([row({ fromAccount: 'X', toAccount: 'Y' })], own)
    expect(tx.direction).toBe('unresolved')
  })

  it('проставляет ключ и пустую категорию', () => {
    const [tx] = toTransactions([row()], own)
    expect(tx.key).toMatch(/#1$/)
    expect(tx.categoryId).toBeNull()
  })

  it('сохраняет детали сырыми, без нормализации', () => {
    const [tx] = toTransactions([row()], own)
    expect(tx.details).toBe('Ք: ASK 23 LLC YEREVAN AM 887772')
  })

  it('называет номер строки в сообщении об ошибке', () => {
    expect(() => toTransactions([row(), row({ amount: 'мусор' })], own))
      .toThrow(/Строка 2/)
  })
})
```

- [ ] **Step 2: Запустить тест и убедиться, что он падает**

Run: `npx vitest run src/import/transactions.test.js`
Expected: FAIL — `Failed to resolve import "./transactions.js"`

- [ ] **Step 3: Реализовать сборку**

`src/import/transactions.js`:

```js
import { parseAmount } from './money.js'
import { parseDate } from './date.js'
import { assignKeys } from './key.js'

function directionOf(fromMine, toMine) {
  if (fromMine && toMine) return 'internal'
  if (fromMine) return 'expense'
  if (toMine) return 'income'
  return 'unresolved'
}

export function toTransactions(namedRows, ownAccounts) {
  const own = new Set(ownAccounts)

  const mapped = namedRows.map((row, index) => {
    let date
    let amount
    try {
      date = parseDate(row.date)
      amount = parseAmount(row.amount)
    } catch (error) {
      throw new Error(`Строка ${index + 1}: ${error.message}`)
    }

    return {
      date,
      opType: row.opType,
      fromAccount: row.fromAccount,
      toAccount: row.toAccount,
      counterparty: row.counterparty,
      details: row.details,
      comment: row.comment,
      status: row.status,
      amount,
      currency: row.currency,
      direction: directionOf(own.has(row.fromAccount), own.has(row.toAccount)),
      categoryId: null,
    }
  })

  return assignKeys(mapped)
}
```

- [ ] **Step 4: Запустить тесты — должны пройти**

Run: `npx vitest run src/import/transactions.test.js`
Expected: PASS, 7 тестов

- [ ] **Step 5: Коммит**

```bash
git add src/import/transactions.js src/import/transactions.test.js
git commit -m "Собирать транзакции и определять направление по своим счетам"
```

---

### Task 8: Нормализация имени мерчанта

Нормализация нужна **только** для группировки на экране и для подсказки текста правила. Ни идентичность операции, ни сопоставление правил от неё не зависят, поэтому её ошибка не может исказить суммы.

**Files:**
- Create: `src/rules/normalize.js`
- Test: `src/rules/normalize.test.js`

**Interfaces:**
- Consumes: ничего
- Produces:
  - `normalizeMerchant(details: string) => string`
  - `suggestRuleText(tx) => string` — текст, предлагаемый как новое правило

- [ ] **Step 1: Написать падающий тест**

`src/rules/normalize.test.js`:

```js
import { describe, it, expect } from 'vitest'
import { normalizeMerchant, suggestRuleText } from './normalize.js'

describe('normalizeMerchant', () => {
  it('снимает префикс карточной операции', () => {
    expect(normalizeMerchant('Ք: OPTIM MARKET')).toBe('OPTIM MARKET')
  })

  it('отрезает хвостовой номер транзакции от двух цифр', () => {
    expect(normalizeMerchant('Ք: ASK 23 LLC YEREVAN AM 887772')).toBe('ASK 23 LLC YEREVAN AM')
    expect(normalizeMerchant('Ք: TELCELL TRANSPORT YEREVAN AM 93')).toBe('TELCELL TRANSPORT YEREVAN AM')
    expect(normalizeMerchant('Ք: ROSTOFARM LLC ROSTOFARM LLC 051')).toBe('ROSTOFARM LLC ROSTOFARM LLC')
  })

  it('склеивает один и тот же мерчант, обрезанный банком по-разному', () => {
    const variants = [
      'Ք: TELCELL TRANSPORT YEREVAN AM 93',
      'Ք: TELCELL TRANSPORT YEREVAN AM 12',
      'Ք: TELCELL TRANSPORT YEREVAN AM 49',
    ].map(normalizeMerchant)
    expect(new Set(variants).size).toBe(1)
  })

  it('не трогает одиночную цифру в названии', () => {
    expect(normalizeMerchant('Ք: YEREVAN CITY T.METS 1')).toBe('YEREVAN CITY T.METS 1')
  })

  it('схлопывает пробелы и приводит к верхнему регистру', () => {
    expect(normalizeMerchant('Ք:   optim   market')).toBe('OPTIM MARKET')
  })

  it('работает с армянским текстом', () => {
    expect(normalizeMerchant('Ք: Գանձում փոխանցման համար Ամերիաբ')).toBe(
      'ԳԱՆՁՈՒՄ ՓՈԽԱՆՑՄԱՆ ՀԱՄԱՐ ԱՄԵՐԻԱԲ',
    )
  })
})

describe('suggestRuleText', () => {
  it('предлагает нормализованные детали', () => {
    expect(suggestRuleText({ details: 'Ք: OPTIM MARKET 4512', counterparty: 'X' }))
      .toBe('OPTIM MARKET')
  })

  it('откатывается на контрагента, если детали пусты', () => {
    expect(suggestRuleText({ details: '', counterparty: '«ԱՍԿ 23» ՍՊԸ' }))
      .toBe('«ԱՍԿ 23» ՍՊԸ')
  })
})
```

- [ ] **Step 2: Запустить тест и убедиться, что он падает**

Run: `npx vitest run src/rules/normalize.test.js`
Expected: FAIL — `Failed to resolve import "./normalize.js"`

- [ ] **Step 3: Реализовать нормализацию**

`src/rules/normalize.js`:

```js
// Порог в две цифры выбран замером на реальной выгрузке: 137 сырых описаний
// схлопываются в 53 группы, и ни одно название мерчанта при этом не повреждается —
// все отрезаемые хвосты оказались обрезанными номерами транзакций.
const CARD_PREFIX = /^Ք:\s*/
const TRAILING_REF = /\s+\d{2,}$/

export function normalizeMerchant(details) {
  const text = String(details ?? '').trim().replace(CARD_PREFIX, '')
  return text.replace(TRAILING_REF, '').replace(/\s+/g, ' ').trim().toUpperCase()
}

export function suggestRuleText(tx) {
  const fromDetails = normalizeMerchant(tx.details)
  return fromDetails || String(tx.counterparty ?? '').trim()
}
```

- [ ] **Step 4: Запустить тесты — должны пройти**

Run: `npx vitest run src/rules/normalize.test.js`
Expected: PASS, 8 тестов

- [ ] **Step 5: Коммит**

```bash
git add src/rules/normalize.js src/rules/normalize.test.js
git commit -m "Нормализовать имена мерчантов для группировки и подсказки правил"
```

---

### Task 9: Подбор категории

Сопоставление идёт **подстрокой по сырому тексту**, а не по нормализованному равенству: обрезка банка необратима, но правило `TELCELL` находится в любом её варианте.

**Files:**
- Create: `src/rules/match.js`
- Test: `src/rules/match.test.js`

**Interfaces:**
- Consumes: ничего
- Produces:
  - `categorize(tx, { rules, overrides, opTypeCategories }) => string | null`
  - `applyCategories(transactions, settings) => Transaction[]` — возвращает новый массив с заполненным `categoryId`
  - `rulePreview(transactions, rule) => { count: number, amount: number }` — сколько операций затронет новое правило

- [ ] **Step 1: Написать падающий тест**

`src/rules/match.test.js`:

```js
import { describe, it, expect } from 'vitest'
import { categorize, applyCategories, rulePreview } from './match.js'

const tx = (over) => ({
  key: 'k1', date: '2026-09-19', opType: 'Քարտային գործարք', fromAccount: 'MINE',
  toAccount: 'SHOP', counterparty: '«ԱՍԿ 23» ՍՊԸ', details: 'Ք: ASK 23 LLC YEREVAN AM 887772',
  comment: '', status: 'Հաստատված', amount: 300000, currency: 'AMD',
  direction: 'expense', categoryId: null, ...over,
})

const settings = {
  rules: [{ match: 'ASK 23', category: 'groceries' }],
  overrides: {},
  opTypeCategories: { 'Փոխանցման միջնորդավճար': 'fees' },
}

describe('categorize', () => {
  it('находит правило подстрокой в обрезанных деталях', () => {
    expect(categorize(tx(), settings)).toBe('groceries')
  })

  it('не зависит от регистра', () => {
    expect(categorize(tx({ details: 'ք: ask 23 llc' }), settings)).toBe('groceries')
  })

  it('ищет и в контрагенте, и в комментарии', () => {
    expect(categorize(tx({ details: '', counterparty: 'ASK 23' }), settings)).toBe('groceries')
    expect(categorize(tx({ details: '', counterparty: '', comment: 'ASK 23' }), settings))
      .toBe('groceries')
  })

  it('откатывается на тип операции, если текстовых правил не нашлось', () => {
    const fee = tx({ details: 'Գանձում', counterparty: '', opType: 'Փոխանցման միջնորդավճար' })
    expect(categorize(fee, settings)).toBe('fees')
  })

  it('ручная пометка сильнее любого правила', () => {
    const withOverride = { ...settings, overrides: { k1: 'cafe' } }
    expect(categorize(tx(), withOverride)).toBe('cafe')
  })

  it('срабатывает первое подходящее правило по порядку', () => {
    const ordered = {
      ...settings,
      rules: [{ match: 'LLC', category: 'other' }, { match: 'ASK 23', category: 'groceries' }],
    }
    expect(categorize(tx(), ordered)).toBe('other')
  })

  it('уважает сужение правила по направлению', () => {
    const narrowed = {
      ...settings,
      rules: [{ match: 'ASK 23', category: 'refund', direction: 'income' }],
    }
    expect(categorize(tx(), narrowed)).toBeNull()
    expect(categorize(tx({ direction: 'income' }), narrowed)).toBe('refund')
  })

  it('уважает сужение правила по типу операции', () => {
    const narrowed = {
      ...settings,
      rules: [{ match: 'ASK 23', category: 'x', opType: 'Հաշվին փոխանցում' }],
    }
    expect(categorize(tx(), narrowed)).toBeNull()
  })

  it('возвращает null, если ничего не подошло', () => {
    expect(categorize(tx({ details: 'нечто', counterparty: '', opType: 'Հաշվին փոխանցում' }), settings))
      .toBeNull()
  })
})

describe('applyCategories', () => {
  it('заполняет categoryId, не мутируя исходные объекты', () => {
    const source = [tx()]
    const result = applyCategories(source, settings)
    expect(result[0].categoryId).toBe('groceries')
    expect(source[0].categoryId).toBeNull()
  })
})

describe('rulePreview', () => {
  it('считает, сколько операций и денег затронет правило', () => {
    const list = [tx(), tx({ key: 'k2', amount: 100000 }), tx({ key: 'k3', details: 'другое', counterparty: '' })]
    expect(rulePreview(list, { match: 'ASK 23', category: 'groceries' }))
      .toEqual({ count: 2, amount: 400000 })
  })
})
```

- [ ] **Step 2: Запустить тест и убедиться, что он падает**

Run: `npx vitest run src/rules/match.test.js`
Expected: FAIL — `Failed to resolve import "./match.js"`

- [ ] **Step 3: Реализовать подбор**

`src/rules/match.js`:

```js
function haystack(tx) {
  return `${tx.details ?? ''} ${tx.counterparty ?? ''} ${tx.comment ?? ''}`.toUpperCase()
}

export function ruleMatches(tx, rule) {
  if (rule.direction && tx.direction !== rule.direction) return false
  if (rule.opType && tx.opType !== rule.opType) return false
  return haystack(tx).includes(String(rule.match).toUpperCase())
}

// Приоритет: ручная пометка → текстовое правило → тип операции → без категории.
// Ручная пометка всегда сильнее правила, иначе правило молча перетрёт решение человека.
export function categorize(tx, { rules = [], overrides = {}, opTypeCategories = {} } = {}) {
  const manual = overrides[tx.key]
  if (manual) return manual

  for (const rule of rules) {
    if (ruleMatches(tx, rule)) return rule.category
  }

  return opTypeCategories[tx.opType] ?? null
}

export function applyCategories(transactions, settings) {
  return transactions.map((tx) => ({ ...tx, categoryId: categorize(tx, settings) }))
}

export function rulePreview(transactions, rule) {
  let count = 0
  let amount = 0
  for (const tx of transactions) {
    if (ruleMatches(tx, rule)) {
      count += 1
      amount += tx.amount
    }
  }
  return { count, amount }
}
```

- [ ] **Step 4: Запустить тесты — должны пройти**

Run: `npx vitest run src/rules/match.test.js`
Expected: PASS, 11 тестов

- [ ] **Step 5: Коммит**

```bash
git add src/rules/match.js src/rules/match.test.js
git commit -m "Подбирать категорию подстрокой с приоритетом ручной пометки"
```

---

### Task 10: Стартовый набор категорий и правил

Набор собран и проверен на реальной выгрузке: покрывает 150 операций из 225, то есть приложение приезжает не пустым.

**Files:**
- Create: `src/rules/seed.js`
- Test: `src/rules/seed.test.js`

**Interfaces:**
- Consumes: `OP` из `src/domain/constants.js`
- Produces: `SEED_CATEGORIES`, `SEED_RULES`, `SEED_OPTYPE_CATEGORIES`

- [ ] **Step 1: Написать падающий тест**

`src/rules/seed.test.js`:

```js
import { describe, it, expect } from 'vitest'
import { SEED_CATEGORIES, SEED_RULES, SEED_OPTYPE_CATEGORIES } from './seed.js'
import { categorize } from './match.js'
import { OP } from '../domain/constants.js'

const settings = {
  rules: SEED_RULES,
  overrides: {},
  opTypeCategories: SEED_OPTYPE_CATEGORIES,
}

const tx = (over) => ({
  key: 'k', date: '2026-09-19', opType: OP.CARD, fromAccount: 'MINE', toAccount: 'SHOP',
  counterparty: '', details: '', comment: '', status: 'Հաստատված', amount: 100000,
  currency: 'AMD', direction: 'expense', categoryId: null, ...over,
})

describe('стартовый набор', () => {
  it('каждое правило ссылается на существующую категорию', () => {
    const ids = new Set(SEED_CATEGORIES.map((c) => c.id))
    for (const rule of SEED_RULES) expect(ids).toContain(rule.category)
    for (const id of Object.values(SEED_OPTYPE_CATEGORIES)) expect(ids).toContain(id)
  })

  it('идентификаторы категорий уникальны', () => {
    const ids = SEED_CATEGORIES.map((c) => c.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it.each([
    ['Ք: ASK 23 LLC YEREVAN AM 887772', 'groceries'],
    ['Ք: OPTIM MARKET 4512', 'groceries'],
    ['Ք: AKG MORE THAN A PHARMACY LLC YE', 'pharmacy'],
    ['Ք: ROSTOFARM LLC ROSTOFARM LLC 051', 'pharmacy'],
    ['Ք: TELCELL TRANSPORT YEREVAN AM 93', 'transport'],
    ['Ք: YANDEX. GO YEREVAN 123456', 'transport'],
    ['Ք: ZVARTNOTS PARKING 13 YEREVAN AM', 'transport'],
    ['Ք: YANDEX.PLUS ALMATY 255219', 'subscriptions'],
    ['Ք: APPLE.COM/BILL CORK 112233', 'subscriptions'],
    ['Ք: FIGMA SAN FRANCISCO 543283', 'subscriptions'],
    ['Ք: IDRAM UTILITY YEREVAN AM 188295', 'utilities'],
  ])('распознаёт %s как %s', (details, expected) => {
    expect(categorize(tx({ details }), settings)).toBe(expected)
  })

  it('относит комиссии, кредиты и депозиты по типу операции', () => {
    expect(categorize(tx({ opType: OP.TRANSFER_FEE, details: '' }), settings)).toBe('fees')
    expect(categorize(tx({ opType: OP.LOAN_REPAY, details: 'N VP00000001' }), settings))
      .toBe('loan_principal')
    expect(categorize(tx({ opType: OP.INTEREST_REPAY, details: 'N VP00000002' }), settings))
      .toBe('loan_interest')
    expect(categorize(tx({ opType: OP.DEPOSIT_TOPUP, details: '' }), settings)).toBe('deposit')
  })

  it('узнаёт зарплату как доход', () => {
    expect(categorize(tx({ direction: 'income', details: 'Աշխատավարձ օգոստոս' }), settings))
      .toBe('salary')
  })

  it('оставляет личные переводы без категории — их разбирает человек', () => {
    expect(categorize(tx({ opType: OP.TRANSFER_TO_CARD, details: 'Անձնական փոխանցում' }), settings))
      .toBeNull()
  })
})
```

- [ ] **Step 2: Запустить тест и убедиться, что он падает**

Run: `npx vitest run src/rules/seed.test.js`
Expected: FAIL — `Failed to resolve import "./seed.js"`

- [ ] **Step 3: Реализовать стартовый набор**

`src/rules/seed.js`:

```js
import { OP } from '../domain/constants.js'

export const SEED_CATEGORIES = [
  { id: 'groceries', name: 'Продукты', color: '#2f9e44' },
  { id: 'cafe', name: 'Кафе и рестораны', color: '#e8590c' },
  { id: 'pharmacy', name: 'Аптека', color: '#0ca678' },
  { id: 'transport', name: 'Транспорт', color: '#1971c2' },
  { id: 'subscriptions', name: 'Подписки', color: '#7048e8' },
  { id: 'utilities', name: 'Коммуналка', color: '#495057' },
  { id: 'telecom', name: 'Связь', color: '#1098ad' },
  { id: 'shopping', name: 'Покупки', color: '#c2255c' },
  { id: 'fees', name: 'Комиссии банка', color: '#f08c00' },
  { id: 'loan_principal', name: 'Кредит: тело', color: '#a61e4d' },
  { id: 'loan_interest', name: 'Кредит: проценты', color: '#d6336c' },
  { id: 'deposit', name: 'Депозит', color: '#087f5b' },
  { id: 'loan_in', name: 'Кредит получен', color: '#5f3dc4' },
  { id: 'salary', name: 'Зарплата', color: '#2b8a3e' },
  { id: 'other', name: 'Прочее', color: '#868e96' },
]

// Порядок важен: срабатывает первое подходящее правило.
export const SEED_RULES = [
  { match: 'ASK 23', category: 'groceries' },
  { match: 'ԱՍԿ 23', category: 'groceries' },
  { match: 'OPTIM MARKET', category: 'groceries' },
  { match: 'YEREVAN CITY', category: 'groceries' },
  { match: 'EREBUNU SHUKA', category: 'groceries' },

  { match: 'AKG', category: 'pharmacy' },
  { match: 'ROSTOFARM', category: 'pharmacy' },
  { match: 'ԴԵՂԱՏ', category: 'pharmacy' },

  { match: 'YANDEX.PLUS', category: 'subscriptions' },
  { match: 'APPLE.COM', category: 'subscriptions' },
  { match: 'FIGMA', category: 'subscriptions' },
  { match: 'GOOGLE ONE', category: 'subscriptions' },
  { match: 'CLOUDFLARE', category: 'subscriptions' },
  { match: 'PROFIT SOFT', category: 'subscriptions' },

  { match: 'TELCELL', category: 'transport' },
  { match: 'YANDEX. GO', category: 'transport' },
  { match: 'YANDEX.GO', category: 'transport' },
  { match: 'PARKING', category: 'transport' },

  { match: 'UCOM', category: 'telecom' },
  { match: 'TEAM TELECOM', category: 'telecom' },
  { match: 'IDRAM UTILITY', category: 'utilities' },

  { match: 'CORN DOG', category: 'cafe' },
  { match: 'SORISO', category: 'cafe' },

  { match: 'WILDBERRIES', category: 'shopping' },
  { match: 'UNO SHOES', category: 'shopping' },

  { match: 'ԱՇԽԱՏԱՎԱՐՁ', category: 'salary', direction: 'income' },

  { match: 'COMMISSION', category: 'fees' },
  { match: 'ԳԱՆՁՈՒՄ', category: 'fees' },
  { match: 'ՄԻՋՆ.', category: 'fees' },
]

// Разметка, которую банк проставляет сам — точная и бесплатная.
export const SEED_OPTYPE_CATEGORIES = {
  [OP.TRANSFER_FEE]: 'fees',
  [OP.LOAN_REPAY]: 'loan_principal',
  [OP.INTEREST_REPAY]: 'loan_interest',
  [OP.DEPOSIT_TOPUP]: 'deposit',
  [OP.LOAN_ISSUE]: 'loan_in',
}
```

- [ ] **Step 4: Запустить тесты — должны пройти**

Run: `npx vitest run src/rules/seed.test.js`
Expected: PASS, 16 тестов

- [ ] **Step 5: Коммит**

```bash
git add src/rules/seed.js src/rules/seed.test.js
git commit -m "Поставлять стартовые категории и правила, проверенные на реальных данных"
```

---

### Task 11: Агрегаты и инвариант сходимости

Главный тест этой задачи — не «функция вернула число», а «агрегаты сходятся с транзакциями». Если сумма по категориям разойдётся с суммой расходов, приложение врёт, и тест обязан падать.

**Files:**
- Create: `src/stats/aggregate.js`
- Test: `src/stats/aggregate.test.js`

**Interfaces:**
- Consumes: `STATUS_APPROVED` из `src/domain/constants.js`, `monthOf` из `src/import/date.js`, `normalizeMerchant` из `src/rules/normalize.js`
- Produces:
  - `countable(transactions) => Transaction[]` — только подтверждённые доходы и расходы
  - `totals(transactions) => { income, expense, net }`
  - `byMonth(transactions) => Array<{ month, income, expense, net }>` — по возрастанию месяца
  - `byCategory(transactions, direction) => Array<{ categoryId, amount, count }>` — по убыванию суммы
  - `byMerchant(transactions, direction) => Array<{ merchant, amount, count }>` — по убыванию суммы
  - `uncategorized(transactions) => Transaction[]` — по убыванию суммы

- [ ] **Step 1: Написать падающий тест**

`src/stats/aggregate.test.js`:

```js
import { describe, it, expect } from 'vitest'
import { countable, totals, byMonth, byCategory, byMerchant, uncategorized } from './aggregate.js'

const tx = (over) => ({
  key: Math.random().toString(36), date: '2026-09-19', opType: 'Քարտային գործարք',
  fromAccount: 'MINE', toAccount: 'SHOP', counterparty: '', details: 'Ք: ASK 23 LLC 887772',
  comment: '', status: 'Հաստատված', amount: 100000, currency: 'AMD',
  direction: 'expense', categoryId: 'groceries', ...over,
})

describe('countable', () => {
  it('оставляет только подтверждённые доходы и расходы', () => {
    const list = [
      tx(),
      tx({ direction: 'income' }),
      tx({ direction: 'internal' }),
      tx({ direction: 'unresolved' }),
      tx({ status: 'Մերժված' }),
    ]
    expect(countable(list)).toHaveLength(2)
  })
})

describe('totals', () => {
  it('считает пришло, ушло и чистый результат', () => {
    const list = [tx({ amount: 300000 }), tx({ direction: 'income', amount: 500000 })]
    expect(totals(list)).toEqual({ income: 500000, expense: 300000, net: 200000 })
  })

  it('не учитывает внутренние переводы', () => {
    const list = [tx({ amount: 300000 }), tx({ direction: 'internal', amount: 999999 })]
    expect(totals(list).expense).toBe(300000)
  })
})

describe('byMonth', () => {
  it('группирует по месяцам по возрастанию', () => {
    const list = [
      tx({ date: '2026-09-19', amount: 100000 }),
      tx({ date: '2026-07-01', amount: 200000 }),
      tx({ date: '2026-09-02', direction: 'income', amount: 500000 }),
    ]
    expect(byMonth(list)).toEqual([
      { month: '2026-07', income: 0, expense: 200000, net: -200000 },
      { month: '2026-09', income: 500000, expense: 100000, net: 400000 },
    ])
  })
})

describe('byCategory', () => {
  it('складывает по категориям и сортирует по убыванию суммы', () => {
    const list = [
      tx({ categoryId: 'groceries', amount: 100000 }),
      tx({ categoryId: 'transport', amount: 300000 }),
      tx({ categoryId: 'groceries', amount: 50000 }),
    ]
    expect(byCategory(list, 'expense')).toEqual([
      { categoryId: 'transport', amount: 300000, count: 1 },
      { categoryId: 'groceries', amount: 150000, count: 2 },
    ])
  })

  it('отдельной строкой показывает операции без категории', () => {
    const result = byCategory([tx({ categoryId: null, amount: 70000 })], 'expense')
    expect(result).toEqual([{ categoryId: null, amount: 70000, count: 1 }])
  })
})

describe('byMerchant', () => {
  it('группирует по нормализованному имени', () => {
    const list = [
      tx({ details: 'Ք: TELCELL TRANSPORT YEREVAN AM 93', amount: 10000 }),
      tx({ details: 'Ք: TELCELL TRANSPORT YEREVAN AM 12', amount: 20000 }),
    ]
    expect(byMerchant(list, 'expense')).toEqual([
      { merchant: 'TELCELL TRANSPORT YEREVAN AM', amount: 30000, count: 2 },
    ])
  })
})

describe('uncategorized', () => {
  it('ставит самые крупные суммы наверх — там лежат основные деньги', () => {
    const list = [
      tx({ categoryId: null, amount: 10000 }),
      tx({ categoryId: null, amount: 900000 }),
      tx({ categoryId: 'groceries', amount: 500000 }),
    ]
    expect(uncategorized(list).map((t) => t.amount)).toEqual([900000, 10000])
  })
})

describe('инвариант сходимости', () => {
  const list = [
    tx({ amount: 123456, categoryId: 'groceries' }),
    tx({ amount: 789, categoryId: 'transport' }),
    tx({ amount: 42, categoryId: null }),
    tx({ direction: 'income', amount: 555555, categoryId: 'salary' }),
    tx({ direction: 'internal', amount: 777777 }),
    tx({ status: 'Մերժված', amount: 888888 }),
    tx({ date: '2026-08-15', amount: 31337, categoryId: 'cafe' }),
  ]

  it('сумма по категориям равна сумме расходов', () => {
    const sum = byCategory(list, 'expense').reduce((acc, row) => acc + row.amount, 0)
    expect(sum).toBe(totals(list).expense)
  })

  it('сумма по месяцам равна общим итогам', () => {
    const months = byMonth(list)
    expect(months.reduce((acc, m) => acc + m.expense, 0)).toBe(totals(list).expense)
    expect(months.reduce((acc, m) => acc + m.income, 0)).toBe(totals(list).income)
  })

  it('пришло минус ушло равно чистому результату', () => {
    const { income, expense, net } = totals(list)
    expect(net).toBe(income - expense)
  })
})
```

- [ ] **Step 2: Запустить тест и убедиться, что он падает**

Run: `npx vitest run src/stats/aggregate.test.js`
Expected: FAIL — `Failed to resolve import "./aggregate.js"`

- [ ] **Step 3: Реализовать агрегаты**

`src/stats/aggregate.js`:

```js
import { STATUS_APPROVED } from '../domain/constants.js'
import { monthOf } from '../import/date.js'
import { normalizeMerchant } from '../rules/normalize.js'

const COUNTABLE_DIRECTIONS = new Set(['expense', 'income'])

// В статистику идут только подтверждённые доходы и расходы.
// Внутренние переводы и операции без опознанных счетов исключены сознательно:
// иначе перекладывание денег между своими счетами раздувает и доход, и расход.
export function countable(transactions) {
  return transactions.filter(
    (tx) => tx.status === STATUS_APPROVED && COUNTABLE_DIRECTIONS.has(tx.direction),
  )
}

export function totals(transactions) {
  let income = 0
  let expense = 0
  for (const tx of countable(transactions)) {
    if (tx.direction === 'income') income += tx.amount
    else expense += tx.amount
  }
  return { income, expense, net: income - expense }
}

export function byMonth(transactions) {
  const months = new Map()
  for (const tx of countable(transactions)) {
    const month = monthOf(tx.date)
    if (!months.has(month)) months.set(month, { month, income: 0, expense: 0, net: 0 })
    const row = months.get(month)
    if (tx.direction === 'income') row.income += tx.amount
    else row.expense += tx.amount
  }
  return Array.from(months.values())
    .map((row) => ({ ...row, net: row.income - row.expense }))
    .sort((a, b) => a.month.localeCompare(b.month))
}

function groupBy(transactions, direction, keyOf, keyName) {
  const groups = new Map()
  for (const tx of countable(transactions)) {
    if (tx.direction !== direction) continue
    const key = keyOf(tx)
    if (!groups.has(key)) groups.set(key, { [keyName]: key, amount: 0, count: 0 })
    const row = groups.get(key)
    row.amount += tx.amount
    row.count += 1
  }
  return Array.from(groups.values()).sort((a, b) => b.amount - a.amount)
}

export function byCategory(transactions, direction = 'expense') {
  return groupBy(transactions, direction, (tx) => tx.categoryId ?? null, 'categoryId')
}

export function byMerchant(transactions, direction = 'expense') {
  return groupBy(transactions, direction, (tx) => normalizeMerchant(tx.details), 'merchant')
}

// Сортировка по убыванию суммы: неразобранные переводы держат основную массу денег,
// поэтому разбирать их имеет смысл сверху вниз.
export function uncategorized(transactions) {
  return countable(transactions)
    .filter((tx) => !tx.categoryId)
    .sort((a, b) => b.amount - a.amount)
}
```

- [ ] **Step 4: Запустить тесты — должны пройти**

Run: `npx vitest run src/stats/aggregate.test.js`
Expected: PASS, 11 тестов

- [ ] **Step 5: Коммит**

```bash
git add src/stats/aggregate.js src/stats/aggregate.test.js
git commit -m "Считать агрегаты и закрепить инвариант сходимости сумм"
```

---

### Task 12: Бюджеты и прогноз перерасхода

**Files:**
- Create: `src/stats/budget.js`
- Test: `src/stats/budget.test.js`

**Interfaces:**
- Consumes: `countable` из `src/stats/aggregate.js`, `monthOf` из `src/import/date.js`
- Produces:
  - `daysInMonth(month: string) => number`
  - `budgetProgress(transactions, budgets, month, today) => Array<{ categoryId, limit, spent, share, projectedTotal, overrunDay }>` — `overrunDay` это число месяца или `null`, если перерасход не прогнозируется

- [ ] **Step 1: Написать падающий тест**

`src/stats/budget.test.js`:

```js
import { describe, it, expect } from 'vitest'
import { daysInMonth, budgetProgress } from './budget.js'

const tx = (over) => ({
  key: Math.random().toString(36), date: '2026-09-10', opType: 'Քարտային գործարք',
  fromAccount: 'MINE', toAccount: 'SHOP', counterparty: '', details: '', comment: '',
  status: 'Հաստատված', amount: 100000, currency: 'AMD', direction: 'expense',
  categoryId: 'groceries', ...over,
})

describe('daysInMonth', () => {
  it('знает длину месяца', () => {
    expect(daysInMonth('2026-09')).toBe(30)
    expect(daysInMonth('2026-02')).toBe(28)
    expect(daysInMonth('2024-02')).toBe(29)
  })
})

describe('budgetProgress', () => {
  const budgets = { groceries: 300000 }

  it('считает потраченное по категории за месяц', () => {
    const list = [tx({ amount: 120000 }), tx({ amount: 30000 })]
    const [row] = budgetProgress(list, budgets, '2026-09', '2026-09-10')
    expect(row.spent).toBe(150000)
    expect(row.limit).toBe(300000)
    expect(row.share).toBeCloseTo(0.5)
  })

  it('не считает чужие месяцы, доходы и внутренние переводы', () => {
    const list = [
      tx({ amount: 120000 }),
      tx({ amount: 999999, date: '2026-08-10' }),
      tx({ amount: 999999, direction: 'income' }),
      tx({ amount: 999999, direction: 'internal' }),
    ]
    const [row] = budgetProgress(list, budgets, '2026-09', '2026-09-10')
    expect(row.spent).toBe(120000)
  })

  it('строит прогноз по текущему темпу', () => {
    const list = [tx({ amount: 50000, date: '2026-09-01' })]
    const [row] = budgetProgress(list, budgets, '2026-09', '2026-09-10')
    expect(row.projectedTotal).toBe(150000)
  })

  it('называет день, когда лимит будет пробит', () => {
    const list = [tx({ amount: 50000, date: '2026-09-01' })]
    const [row] = budgetProgress(list, { groceries: 100000 }, '2026-09', '2026-09-10')
    expect(row.overrunDay).toBe(20)
  })

  it('не пугает перерасходом, если прогноз укладывается в лимит', () => {
    const list = [tx({ amount: 10000, date: '2026-09-01' })]
    const [row] = budgetProgress(list, budgets, '2026-09', '2026-09-10')
    expect(row.overrunDay).toBeNull()
  })

  it('для прошедшего месяца прогноз равен факту', () => {
    const list = [tx({ amount: 250000, date: '2026-08-15' })]
    const [row] = budgetProgress(list, budgets, '2026-08', '2026-09-10')
    expect(row.projectedTotal).toBe(250000)
  })

  it('без трат отдаёт нули и не делит на ноль', () => {
    const [row] = budgetProgress([], budgets, '2026-09', '2026-09-10')
    expect(row).toEqual({
      categoryId: 'groceries', limit: 300000, spent: 0, share: 0,
      projectedTotal: 0, overrunDay: null,
    })
  })
})
```

- [ ] **Step 2: Запустить тест и убедиться, что он падает**

Run: `npx vitest run src/stats/budget.test.js`
Expected: FAIL — `Failed to resolve import "./budget.js"`

- [ ] **Step 3: Реализовать бюджеты**

`src/stats/budget.js`:

```js
import { countable } from './aggregate.js'
import { monthOf } from '../import/date.js'

export function daysInMonth(month) {
  const [year, monthNumber] = month.split('-').map(Number)
  return new Date(Date.UTC(year, monthNumber, 0)).getUTCDate()
}

function elapsedDays(month, today) {
  const total = daysInMonth(month)
  const currentMonth = monthOf(today)
  if (currentMonth > month) return total
  if (currentMonth < month) return 0
  return Math.min(total, Number(today.slice(8, 10)))
}

export function budgetProgress(transactions, budgets, month, today) {
  const spentByCategory = new Map()
  for (const tx of countable(transactions)) {
    if (tx.direction !== 'expense' || monthOf(tx.date) !== month) continue
    const current = spentByCategory.get(tx.categoryId) ?? 0
    spentByCategory.set(tx.categoryId, current + tx.amount)
  }

  const total = daysInMonth(month)
  const elapsed = elapsedDays(month, today)

  return Object.entries(budgets).map(([categoryId, limit]) => {
    const spent = spentByCategory.get(categoryId) ?? 0
    const dailyRate = elapsed > 0 ? spent / elapsed : 0
    const projectedTotal = Math.round(dailyRate * total)
    const overrunDay =
      limit > 0 && dailyRate > 0 && projectedTotal > limit
        ? Math.min(total, Math.ceil(limit / dailyRate))
        : null

    return {
      categoryId,
      limit,
      spent,
      share: limit > 0 ? spent / limit : 0,
      projectedTotal,
      overrunDay,
    }
  })
}
```

- [ ] **Step 4: Запустить тесты — должны пройти**

Run: `npx vitest run src/stats/budget.test.js`
Expected: PASS, 8 тестов

- [ ] **Step 5: Коммит**

```bash
git add src/stats/budget.js src/stats/budget.test.js
git commit -m "Считать бюджеты и прогноз перерасхода по текущему темпу"
```

---

### Task 13: Хранение транзакций в IndexedDB

**Files:**
- Create: `src/store/db.js`
- Test: `src/store/db.test.js`

**Interfaces:**
- Consumes: ничего
- Produces: `openDb()`, `saveTransactions(transactions)`, `loadTransactions()`, `clearTransactions()` — все асинхронные, ключ хранилища — `tx.key`

- [ ] **Step 1: Написать падающий тест**

`src/store/db.test.js`:

```js
import 'fake-indexeddb/auto'
import { describe, it, expect, beforeEach } from 'vitest'
import { saveTransactions, loadTransactions, clearTransactions } from './db.js'

const tx = (key, over = {}) => ({
  key, date: '2026-09-19', opType: 'Քարտային գործարք', fromAccount: 'MINE', toAccount: 'SHOP',
  counterparty: '', details: '', comment: '', status: 'Հաստատված', amount: 100000,
  currency: 'AMD', direction: 'expense', categoryId: null, ...over,
})

describe('хранилище транзакций', () => {
  beforeEach(async () => {
    await clearTransactions()
  })

  it('на пустой базе отдаёт пустой список', async () => {
    expect(await loadTransactions()).toEqual([])
  })

  it('сохраняет и читает обратно', async () => {
    await saveTransactions([tx('a'), tx('b')])
    const loaded = await loadTransactions()
    expect(loaded.map((t) => t.key).sort()).toEqual(['a', 'b'])
  })

  it('перезапись по ключу обновляет запись, а не плодит вторую', async () => {
    await saveTransactions([tx('a', { categoryId: null })])
    await saveTransactions([tx('a', { categoryId: 'groceries' })])
    const loaded = await loadTransactions()
    expect(loaded).toHaveLength(1)
    expect(loaded[0].categoryId).toBe('groceries')
  })

  it('очистка опустошает хранилище', async () => {
    await saveTransactions([tx('a')])
    await clearTransactions()
    expect(await loadTransactions()).toEqual([])
  })

  it('переживает сохранение пустого массива', async () => {
    await saveTransactions([])
    expect(await loadTransactions()).toEqual([])
  })
})
```

- [ ] **Step 2: Запустить тест и убедиться, что он падает**

Run: `npx vitest run src/store/db.test.js`
Expected: FAIL — `Failed to resolve import "./db.js"`

- [ ] **Step 3: Реализовать хранилище**

`src/store/db.js`:

```js
const DB_NAME = 'ameria-view'
const DB_VERSION = 1
const STORE = 'transactions'

export function openDb() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION)
    request.onupgradeneeded = () => {
      const db = request.result
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE, { keyPath: 'key' })
      }
    }
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
}

function runTransaction(db, mode, work) {
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE, mode)
    const result = work(transaction.objectStore(STORE))
    transaction.oncomplete = () => resolve(result)
    transaction.onerror = () => reject(transaction.error)
    transaction.onabort = () => reject(transaction.error)
  })
}

export async function saveTransactions(transactions) {
  const db = await openDb()
  try {
    await runTransaction(db, 'readwrite', (store) => {
      for (const item of transactions) store.put(item)
    })
  } finally {
    db.close()
  }
}

export async function loadTransactions() {
  const db = await openDb()
  try {
    return await new Promise((resolve, reject) => {
      const request = db.transaction(STORE).objectStore(STORE).getAll()
      request.onsuccess = () => resolve(request.result ?? [])
      request.onerror = () => reject(request.error)
    })
  } finally {
    db.close()
  }
}

export async function clearTransactions() {
  const db = await openDb()
  try {
    await runTransaction(db, 'readwrite', (store) => store.clear())
  } finally {
    db.close()
  }
}
```

- [ ] **Step 4: Запустить тесты — должны пройти**

Run: `npx vitest run src/store/db.test.js`
Expected: PASS, 5 тестов

- [ ] **Step 5: Коммит**

```bash
git add src/store/db.js src/store/db.test.js
git commit -m "Хранить транзакции в IndexedDB с перезаписью по ключу"
```

---

### Task 14: Настройки и rules.json

Ценное отделено от одноразового: транзакции всегда восстановимы из банка, а ручная разметка — нет. Поэтому у настроек три уровня: рабочая копия в `localStorage`, базовая версия в закоммиченном `rules.json`, и стартовый набор в коде как последний рубеж.

**Files:**
- Create: `rules.json` (корень репозитория), `src/store/settings.js`
- Test: `src/store/settings.test.js`

**Interfaces:**
- Consumes: `SEED_CATEGORIES`, `SEED_RULES`, `SEED_OPTYPE_CATEGORIES`
- Produces:
  - `SETTINGS_VERSION = 1`
  - `defaultSettings() => Settings`
  - `loadSettings() => Settings` — localStorage → `rules.json` → стартовый набор
  - `saveSettings(settings) => void`
  - `serializeSettings(settings) => string`
  - `parseSettings(json: string) => Settings` — бросает исключение на чужом формате

- [ ] **Step 1: Написать падающий тест**

`src/store/settings.test.js`:

```js
import { describe, it, expect, beforeEach } from 'vitest'
import {
  SETTINGS_VERSION, defaultSettings, loadSettings, saveSettings,
  serializeSettings, parseSettings,
} from './settings.js'

describe('настройки', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('по умолчанию приезжают стартовые категории и правила', () => {
    const settings = defaultSettings()
    expect(settings.version).toBe(SETTINGS_VERSION)
    expect(settings.categories.length).toBeGreaterThan(0)
    expect(settings.rules.length).toBeGreaterThan(0)
    expect(settings.ownAccounts).toEqual([])
    expect(settings.overrides).toEqual({})
    expect(settings.budgets).toEqual({})
  })

  it('сохраняет и читает рабочую копию', () => {
    const settings = { ...defaultSettings(), ownAccounts: ['MINE1'] }
    saveSettings(settings)
    expect(loadSettings().ownAccounts).toEqual(['MINE1'])
  })

  it('без рабочей копии откатывается на значения по умолчанию', () => {
    expect(loadSettings().rules.length).toBe(defaultSettings().rules.length)
  })

  it('переживает испорченную рабочую копию', () => {
    localStorage.setItem('ameria-view:settings', '{это не json')
    expect(loadSettings().version).toBe(SETTINGS_VERSION)
  })

  it('сериализация и разбор дают тот же объект', () => {
    const settings = { ...defaultSettings(), budgets: { groceries: 300000 } }
    expect(parseSettings(serializeSettings(settings))).toEqual(settings)
  })

  it('отвергает файл чужой версии', () => {
    expect(() => parseSettings(JSON.stringify({ version: 99, rules: [] })))
      .toThrow(/версии/)
  })

  it('отвергает не-JSON', () => {
    expect(() => parseSettings('мусор')).toThrow(/разобрать/)
  })

  it('отвергает JSON без обязательных полей', () => {
    expect(() => parseSettings(JSON.stringify({ version: SETTINGS_VERSION })))
      .toThrow(/поле/)
  })
})
```

- [ ] **Step 2: Запустить тест и убедиться, что он падает**

Run: `npx vitest run src/store/settings.test.js`
Expected: FAIL — `Failed to resolve import "./settings.js"`

- [ ] **Step 3: Создать базовый `rules.json` в корне репозитория**

```json
{
  "version": 1,
  "ownAccounts": [],
  "categories": [],
  "rules": [],
  "overrides": {},
  "budgets": {}
}
```

Пустые `categories` и `rules` означают «использовать стартовый набор из кода».
Этот файл — место, куда пользователь кладёт выгруженную из приложения разметку,
чтобы она была под git.

- [ ] **Step 4: Реализовать настройки**

`src/store/settings.js`:

```js
import baseline from '../../rules.json'
import { SEED_CATEGORIES, SEED_RULES, SEED_OPTYPE_CATEGORIES } from '../rules/seed.js'

export const SETTINGS_VERSION = 1
const STORAGE_KEY = 'ameria-view:settings'
const REQUIRED_FIELDS = ['ownAccounts', 'categories', 'rules', 'overrides', 'budgets']

export function defaultSettings() {
  return {
    version: SETTINGS_VERSION,
    ownAccounts: baseline.ownAccounts?.length ? [...baseline.ownAccounts] : [],
    categories: baseline.categories?.length ? [...baseline.categories] : [...SEED_CATEGORIES],
    rules: baseline.rules?.length ? [...baseline.rules] : [...SEED_RULES],
    overrides: { ...(baseline.overrides ?? {}) },
    budgets: { ...(baseline.budgets ?? {}) },
    opTypeCategories: { ...SEED_OPTYPE_CATEGORIES },
  }
}

export function serializeSettings(settings) {
  return JSON.stringify(settings, null, 2)
}

export function parseSettings(json) {
  let parsed
  try {
    parsed = JSON.parse(json)
  } catch {
    throw new Error('Не удалось разобрать файл настроек: это не JSON')
  }
  if (parsed.version !== SETTINGS_VERSION) {
    throw new Error(
      `Файл настроек версии ${parsed.version}, приложение понимает версию ${SETTINGS_VERSION}`,
    )
  }
  for (const field of REQUIRED_FIELDS) {
    if (!(field in parsed)) throw new Error(`В файле настроек отсутствует поле ${field}`)
  }
  return parsed
}

export function loadSettings() {
  const raw = localStorage.getItem(STORAGE_KEY)
  if (!raw) return defaultSettings()
  try {
    return { ...defaultSettings(), ...parseSettings(raw) }
  } catch {
    return defaultSettings()
  }
}

export function saveSettings(settings) {
  localStorage.setItem(STORAGE_KEY, serializeSettings(settings))
}
```

- [ ] **Step 5: Запустить тесты — должны пройти**

Run: `npx vitest run src/store/settings.test.js`
Expected: PASS, 8 тестов

Примечание: тест «сериализация и разбор дают тот же объект» сравнивает объект целиком,
поэтому `opTypeCategories` должен пережить круг — он есть и в `defaultSettings()`,
и в сериализованном JSON.

- [ ] **Step 6: Коммит**

```bash
git add rules.json src/store/settings.js src/store/settings.test.js
git commit -m "Хранить разметку в настройках с откатом на rules.json и стартовый набор"
```

---

### Task 15: Обезличенная фикстура и сквозной тест на реальной выгрузке

Сквозная проверка на настоящем файле — единственный тест, который ловит расхождение между тем, что мы предположили про банк, и тем, что банк отдаёт. Входной файл **никогда не коммитится**, коммитится только обезличенный результат.

**Files:**
- Create: `tools/anonymize.mjs`
- Create: `test/fixtures/history-anon.xls` (порождается инструментом)
- Test: `test/golden.test.js`

**Interfaces:**
- Consumes: `buildWorkbook`, `readSheetRows`, `toNamedRows`, `detectOwnAccounts`, `toTransactions`, `applyCategories`, `countable`
- Produces: обезличенную фикстуру

- [ ] **Step 1: Написать инструмент обезличивания**

`tools/anonymize.mjs`:

```js
// Обезличивает реальную выгрузку myAmeria History в фикстуру для тестов.
// Читает XLSX своими средствами (без DOMParser, которого нет в голом Node).
// Использование: node tools/anonymize.mjs <входной .xls> <выходной .xls>
import { readFileSync, writeFileSync } from 'node:fs'
import { unzipSync, strFromU8 } from 'fflate'
import { buildWorkbook } from '../test/fixtures/buildWorkbook.js'

// Значения, содержащие любой из этих токенов, считаются названиями организаций
// и сохраняются как есть. Всё остальное — потенциально персональное, заменяется.
const BUSINESS_TOKENS = [
  'ASK 23', 'ԱՍԿ 23', 'OPTIM', 'YEREVAN CITY', 'EREBUNU', 'AKG', 'ROSTOFARM', 'ԴԵՂԱՏ',
  'TELCELL', 'YANDEX', 'PARKING', 'APPLE', 'FIGMA', 'GOOGLE', 'CLOUDFLARE', 'PROFIT SOFT',
  'UCOM', 'TEAM TELECOM', 'IDRAM', 'WILDBERRIES', 'UNO SHOES', 'CORN DOG', 'SORISO',
  'ARMENIAN CARD', 'ԱՐՄԵՆԻԱՆ', 'MASTER CARD', 'ԳԱՆՁՈՒՄ', 'ՄԻՋՆ.', 'ԱՇԽԱՏԱՎԱՐՁ',
  'COMMISSION', 'ATM', 'AMERIABAN', 'ԱՄԵՐԻԱԲ', 'ՓՈԽԱՆՑՈՒՄ', 'ԵԿԱՄՈՒՏ',
]

const CARD_PREFIX = /^(Ք:\s*)/
const TRAILING_REF = /(\s+\d{2,})$/

function decodeSheet(bytes) {
  const files = unzipSync(new Uint8Array(bytes))
  const sharedXml = strFromU8(files['xl/sharedStrings.xml'] ?? new Uint8Array())
  const shared = [...sharedXml.matchAll(/<si>(.*?)<\/si>/gs)].map(([, si]) =>
    si
      .replace(/<[^>]+>/g, '')
      .replaceAll('&amp;', '&')
      .replaceAll('&lt;', '<')
      .replaceAll('&gt;', '>'),
  )
  const sheetXml = strFromU8(files['xl/worksheets/sheet1.xml'])
  const rows = []
  for (const [, body] of sheetXml.matchAll(/<row[^>]*>(.*?)<\/row>/gs)) {
    const cells = {}
    for (const match of body.matchAll(/<c ([^>]*?)(?:\/>|>(.*?)<\/c>)/gs)) {
      const attrs = match[1]
      const inner = match[2] ?? ''
      const ref = /r="([A-Z]+)\d+"/.exec(attrs)?.[1]
      const type = /t="(\w+)"/.exec(attrs)?.[1]
      const value = /<v>(.*?)<\/v>/s.exec(inner)?.[1] ?? ''
      if (!ref || value === '') continue
      cells[ref] = type === 's' ? (shared[Number(value)] ?? '') : value
    }
    rows.push(cells)
  }
  return rows
}

function makeMapper(prefix) {
  const seen = new Map()
  return (value) => {
    if (!value) return value
    if (!seen.has(value)) seen.set(value, `${prefix}${String(seen.size + 1).padStart(2, '0')}`)
    return seen.get(value)
  }
}

const isBusiness = (value) =>
  BUSINESS_TOKENS.some((token) => value.toUpperCase().includes(token.toUpperCase()))

function anonymizeText(value, mapPerson) {
  if (!value) return value
  if (isBusiness(value)) return value
  const prefix = CARD_PREFIX.exec(value)?.[1] ?? ''
  const suffix = TRAILING_REF.exec(value)?.[1] ?? ''
  const core = value.slice(prefix.length, value.length - suffix.length)
  return `${prefix}${mapPerson(core)}${suffix}`
}

const [, , inputPath, outputPath] = process.argv
if (!inputPath || !outputPath) {
  console.error('Использование: node tools/anonymize.mjs <вход .xls> <выход .xls>')
  process.exit(1)
}

const rows = decodeSheet(readFileSync(inputPath))
const mapAccount = makeMapper('15700000000000')
const mapPerson = makeMapper('PERSON ')
const COLUMNS = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K']

let headerIndex = -1
const output = rows.map((cells, index) => {
  if (cells.A === 'Ամսաթիվ') headerIndex = index
  if (headerIndex === -1) {
    // Шапка банка: имя владельца вычищается, остальное безвредно.
    return [index === 4 ? 'TEST USER' : (cells.A ?? '')]
  }
  if (index === headerIndex) return COLUMNS.map((column) => cells[column] ?? '')

  const amount = ((index * 7919) % 500000) + 137
  return [
    cells.A ?? '',
    cells.B ?? '',
    cells.C ?? '',
    mapAccount(cells.D ?? ''),
    mapAccount(cells.E ?? ''),
    anonymizeText(cells.F ?? '', mapPerson),
    anonymizeText(cells.G ?? '', mapPerson),
    cells.H ?? '',
    anonymizeText(cells.I ?? '', mapPerson),
    `${Math.floor(amount / 100)}.${String(amount % 100).padStart(2, '0')}`,
    cells.K ?? '',
  ]
})

writeFileSync(outputPath, buildWorkbook(output))
console.log(`Готово: ${output.length} строк -> ${outputPath}`)
```

- [ ] **Step 2: Породить фикстуру из реальной выгрузки**

```bash
node tools/anonymize.mjs ~/Downloads/History_22.07.2026-20.09.2026\ \(1\).xls test/fixtures/history-anon.xls
```

Expected: `Готово: 263 строк -> test/fixtures/history-anon.xls`

(263 строки = 8 строк шапки банка, 254 операции и одна хвостовая строка без даты.
Число проверено на реальной выгрузке.)

Проверить глазами, что в результате нет настоящих имён и сумм — файл это обычный ZIP:

```bash
unzip -p test/fixtures/history-anon.xls xl/sharedStrings.xml | head -c 1500
```

В выводе не должно остаться ни одного настоящего имени: вместо них `PERSON 01`,
`PERSON 02` и так далее, а вместо номеров счетов — `15700000000000NN`.

- [ ] **Step 3: Написать сквозной тест**

`test/golden.test.js`:

```js
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { readSheetRows } from '../src/parse/xlsx.js'
import { toNamedRows } from '../src/parse/table.js'
import { detectOwnAccounts } from '../src/import/accounts.js'
import { toTransactions } from '../src/import/transactions.js'
import { applyCategories } from '../src/rules/match.js'
import { countable, totals, byCategory } from '../src/stats/aggregate.js'
import { defaultSettings } from '../src/store/settings.js'

const bytes = readFileSync(new URL('./fixtures/history-anon.xls', import.meta.url))
const namedRows = toNamedRows(readSheetRows(bytes))
const ownAccounts = detectOwnAccounts(namedRows)
const transactions = toTransactions(namedRows, ownAccounts)

describe('сквозной разбор реальной выгрузки', () => {
  it('разбирает все строки файла', () => {
    expect(namedRows).toHaveLength(254)
  })

  it('находит счета владельца', () => {
    expect(ownAccounts).toHaveLength(4)
  })

  it('классифицирует каждую операцию, не оставляя неопознанных', () => {
    const counts = transactions.reduce((acc, tx) => {
      acc[tx.direction] = (acc[tx.direction] ?? 0) + 1
      return acc
    }, {})
    expect(counts).toEqual({ expense: 214, income: 11, internal: 29 })
    expect(counts.unresolved).toBeUndefined()
  })

  it('выдаёт уникальный ключ каждой операции', () => {
    expect(new Set(transactions.map((tx) => tx.key)).size).toBe(254)
  })

  it('исключает внутренние переводы из статистики', () => {
    expect(countable(transactions)).toHaveLength(225)
  })

  it('стартовые правила покрывают большую часть операций', () => {
    const categorized = applyCategories(transactions, defaultSettings())
    const counted = countable(categorized)
    const withCategory = counted.filter((tx) => tx.categoryId).length
    expect(withCategory / counted.length).toBeGreaterThan(0.6)
  })

  it('сумма по категориям сходится с итогом расходов', () => {
    const categorized = applyCategories(transactions, defaultSettings())
    const sum = byCategory(categorized, 'expense').reduce((acc, row) => acc + row.amount, 0)
    expect(sum).toBe(totals(categorized).expense)
  })
})
```

- [ ] **Step 4: Запустить тест — должен пройти**

Run: `npx vitest run test/golden.test.js`
Expected: PASS, 7 тестов

Если счётчики направлений разойдутся с ожидаемыми — это не повод править тест.
Сначала разобраться, почему изменился разбор: либо изменилось поведение кода,
либо фикстура порождена из другой выгрузки.

- [ ] **Step 5: Запустить всю тестовую базу**

Run: `npx vitest run`
Expected: PASS, все тесты

- [ ] **Step 6: Коммит**

```bash
git add tools/anonymize.mjs test/fixtures/history-anon.xls test/golden.test.js
git commit -m "Добавить обезличенную фикстуру и сквозной тест на реальной выгрузке"
```

---

### Task 16: Конвейер импорта

Склейка всех чистых модулей в одну операцию «дали байты файла — получили транзакции и отчёт». Логика, а не интерфейс, поэтому тестируется без браузера.

**Files:**
- Create: `src/import/pipeline.js`
- Test: `src/import/pipeline.test.js`

**Interfaces:**
- Consumes: `readSheetRows`, `toNamedRows`, `detectOwnAccounts`, `toTransactions`, `mergeTransactions`
- Produces: `importWorkbook(bytes, { existingTransactions, ownAccounts }) => { transactions, detectedAccounts, report }`, где `report` = `{ rows, added, duplicates, unresolved, periodFrom, periodTo }`

- [ ] **Step 1: Написать падающий тест**

`src/import/pipeline.test.js`:

```js
import { describe, it, expect } from 'vitest'
import { buildWorkbook } from '../../test/fixtures/buildWorkbook.js'
import { importWorkbook } from './pipeline.js'
import { HEADERS, OP } from '../domain/constants.js'

const HEADER_ROW = [
  HEADERS.date, HEADERS.docNo, HEADERS.opType, HEADERS.fromAccount, HEADERS.toAccount,
  HEADERS.counterparty, HEADERS.details, HEADERS.status, HEADERS.comment, HEADERS.amount,
  HEADERS.currency,
]

const dataRow = (over = {}) => {
  const row = {
    date: '19-09-2026', docNo: '31', opType: OP.CARD, from: 'MINE1', to: 'SHOP',
    counterparty: '', details: 'Ք: ASK 23 LLC 887772', status: 'Հաստատված', comment: '',
    amount: '3000.0', currency: 'AMD', ...over,
  }
  return [row.date, row.docNo, row.opType, row.from, row.to, row.counterparty,
    row.details, row.status, row.comment, row.amount, row.currency]
}

const workbook = (rows) => buildWorkbook([HEADER_ROW, ...rows])

describe('importWorkbook', () => {
  it('разбирает файл и отчитывается о результате', () => {
    const result = importWorkbook(workbook([dataRow(), dataRow({ date: '20-09-2026' })]))
    expect(result.transactions).toHaveLength(2)
    expect(result.report.rows).toBe(2)
    expect(result.report.added).toBe(2)
    expect(result.report.duplicates).toBe(0)
    expect(result.report.periodFrom).toBe('2026-09-19')
    expect(result.report.periodTo).toBe('2026-09-20')
  })

  it('определяет свои счета сам, если их ещё не подтверждали', () => {
    const result = importWorkbook(workbook([dataRow({ from: 'MINE1' })]))
    expect(result.detectedAccounts).toEqual(['MINE1'])
    expect(result.transactions[0].direction).toBe('expense')
  })

  it('уважает подтверждённый список счетов', () => {
    const result = importWorkbook(workbook([dataRow({ from: 'MINE1', to: 'MINE2' })]), {
      ownAccounts: ['MINE1', 'MINE2'],
    })
    expect(result.transactions[0].direction).toBe('internal')
  })

  it('повторная загрузка того же файла не добавляет дублей', () => {
    const bytes = workbook([dataRow()])
    const first = importWorkbook(bytes)
    const second = importWorkbook(bytes, { existingTransactions: first.transactions })
    expect(second.report.added).toBe(0)
    expect(second.report.duplicates).toBe(1)
    expect(second.transactions).toHaveLength(1)
  })

  it('считает операции, требующие внимания', () => {
    const result = importWorkbook(workbook([dataRow({ from: 'X', to: 'Y', opType: OP.TRANSFER_TO_ACCOUNT })]), {
      ownAccounts: ['MINE1'],
    })
    expect(result.report.unresolved).toBe(1)
  })

  it('на файле без единой операции отдаёт пустой отчёт, а не падает', () => {
    const result = importWorkbook(workbook([]))
    expect(result.transactions).toEqual([])
    expect(result.report).toMatchObject({ rows: 0, added: 0, duplicates: 0, unresolved: 0 })
    expect(result.report.periodFrom).toBeNull()
  })
})
```

- [ ] **Step 2: Запустить тест и убедиться, что он падает**

Run: `npx vitest run src/import/pipeline.test.js`
Expected: FAIL — `Failed to resolve import "./pipeline.js"`

- [ ] **Step 3: Реализовать конвейер**

`src/import/pipeline.js`:

```js
import { readSheetRows } from '../parse/xlsx.js'
import { toNamedRows } from '../parse/table.js'
import { detectOwnAccounts } from './accounts.js'
import { toTransactions } from './transactions.js'
import { mergeTransactions } from './key.js'

export function importWorkbook(bytes, { existingTransactions = [], ownAccounts = null } = {}) {
  const namedRows = toNamedRows(readSheetRows(bytes))
  const detectedAccounts = detectOwnAccounts(namedRows)
  const accounts = ownAccounts && ownAccounts.length ? ownAccounts : detectedAccounts

  const incoming = toTransactions(namedRows, accounts)
  const { merged, added, duplicates } = mergeTransactions(existingTransactions, incoming)

  const dates = incoming.map((tx) => tx.date).sort()

  return {
    transactions: merged,
    detectedAccounts,
    report: {
      rows: namedRows.length,
      added,
      duplicates,
      unresolved: incoming.filter((tx) => tx.direction === 'unresolved').length,
      periodFrom: dates[0] ?? null,
      periodTo: dates[dates.length - 1] ?? null,
    },
  }
}
```

- [ ] **Step 4: Запустить тесты — должны пройти**

Run: `npx vitest run src/import/pipeline.test.js`
Expected: PASS, 6 тестов

- [ ] **Step 5: Коммит**

```bash
git add src/import/pipeline.js src/import/pipeline.test.js
git commit -m "Собрать конвейер импорта с отчётом о результате"
```

---

### Task 17: Каркас интерфейса и экран импорта

**Files:**
- Modify: `src/App.jsx`
- Create: `src/ui/theme.css`, `src/ui/Layout.jsx`, `src/ui/ImportScreen.jsx`, `src/ui/format.js`
- Test: `src/ui/ImportScreen.test.jsx`

**Interfaces:**
- Consumes: `importWorkbook`, `loadSettings`, `saveSettings`, `loadTransactions`, `saveTransactions`, `applyCategories`, `formatAmount`
- Produces:
  - `<Layout screen onNavigate>` — переключение экранов
  - `<ImportScreen onImport detectedAccounts ownAccounts onConfirmAccounts report />`
  - `formatAmd(luma) => string` — сумма с символом драма

- [ ] **Step 1: Написать падающий тест экрана**

`src/ui/ImportScreen.test.jsx`:

```js
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { ImportScreen } from './ImportScreen.jsx'

describe('ImportScreen', () => {
  it('без отчёта объясняет, где взять файл', () => {
    render(<ImportScreen onImport={() => {}} onConfirmAccounts={() => {}} />)
    expect(screen.getByText(/myameria\.am\/history/i)).toBeTruthy()
  })

  it('показывает отчёт об импорте', () => {
    render(
      <ImportScreen
        onImport={() => {}}
        onConfirmAccounts={() => {}}
        report={{ rows: 254, added: 254, duplicates: 0, unresolved: 0,
          periodFrom: '2026-07-22', periodTo: '2026-09-20' }}
      />,
    )
    expect(screen.getByText(/добавлено: 254/i)).toBeTruthy()
    expect(screen.getByText(/дублей: 0/i)).toBeTruthy()
    expect(screen.getByText(/22\.07\.2026/)).toBeTruthy()
  })

  it('предупреждает об операциях, требующих внимания', () => {
    render(
      <ImportScreen
        onImport={() => {}}
        onConfirmAccounts={() => {}}
        report={{ rows: 10, added: 10, duplicates: 0, unresolved: 3,
          periodFrom: '2026-09-01', periodTo: '2026-09-10' }}
      />,
    )
    expect(screen.getByText(/требуют внимания: 3/i)).toBeTruthy()
  })

  it('даёт подтвердить найденные счета', () => {
    const onConfirmAccounts = vi.fn()
    render(
      <ImportScreen
        onImport={() => {}}
        onConfirmAccounts={onConfirmAccounts}
        detectedAccounts={['1570000000000001', '1570000000000002']}
        ownAccounts={[]}
      />,
    )
    fireEvent.click(screen.getByRole('button', { name: /подтвердить счета/i }))
    expect(onConfirmAccounts).toHaveBeenCalledWith([
      '1570000000000001',
      '1570000000000002',
    ])
  })
})
```

- [ ] **Step 2: Запустить тест и убедиться, что он падает**

Run: `npx vitest run src/ui/ImportScreen.test.jsx`
Expected: FAIL — `Failed to resolve import "./ImportScreen.jsx"`

- [ ] **Step 3: Создать форматирование и стили**

`src/ui/format.js`:

```js
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
```

`src/ui/theme.css`:

```css
:root {
  --bg: #12141a;
  --panel: #1a1d26;
  --line: #262b38;
  --text: #e8eaf0;
  --muted: #8d95a8;
  --income: #2f9e44;
  --expense: #e03131;
  --accent: #4c6ef5;
}

* { box-sizing: border-box; }

body {
  margin: 0;
  background: var(--bg);
  color: var(--text);
  font: 15px/1.5 -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
}

.layout { max-width: 1100px; margin: 0 auto; padding: 24px 16px 64px; }
.nav { display: flex; gap: 4px; border-bottom: 1px solid var(--line); margin-bottom: 24px; }
.nav button {
  background: none; border: none; color: var(--muted); padding: 12px 16px;
  font-size: 15px; cursor: pointer; border-bottom: 2px solid transparent;
}
.nav button[aria-current='true'] { color: var(--text); border-bottom-color: var(--accent); }
.panel { background: var(--panel); border: 1px solid var(--line); border-radius: 10px; padding: 20px; }
.dropzone {
  border: 2px dashed var(--line); border-radius: 10px; padding: 48px 24px;
  text-align: center; color: var(--muted); cursor: pointer;
}
.dropzone[data-over='true'] { border-color: var(--accent); color: var(--text); }
.income { color: var(--income); }
.expense { color: var(--expense); }
.muted { color: var(--muted); }
table { width: 100%; border-collapse: collapse; }
th, td { text-align: left; padding: 8px 10px; border-bottom: 1px solid var(--line); }
th { color: var(--muted); font-weight: 500; font-size: 13px; }
td.num, th.num { text-align: right; font-variant-numeric: tabular-nums; }
```

- [ ] **Step 4: Реализовать экран импорта и каркас**

`src/ui/ImportScreen.jsx`:

```jsx
import { useState } from 'react'
import { formatDate, maskAccount } from './format.js'

export function ImportScreen({ onImport, onConfirmAccounts, report, detectedAccounts = [], ownAccounts = [], error }) {
  const [isOver, setIsOver] = useState(false)

  const readFile = (file) => {
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => onImport(new Uint8Array(reader.result))
    reader.readAsArrayBuffer(file)
  }

  const needsConfirmation = detectedAccounts.length > 0 && ownAccounts.length === 0

  return (
    <div>
      <div
        className="dropzone"
        data-over={isOver}
        onDragOver={(event) => { event.preventDefault(); setIsOver(true) }}
        onDragLeave={() => setIsOver(false)}
        onDrop={(event) => {
          event.preventDefault()
          setIsOver(false)
          readFile(event.dataTransfer.files[0])
        }}
        onClick={() => document.getElementById('file-input').click()}
      >
        <p>Перетащи сюда выгрузку из myAmeria</p>
        <p className="muted">
          myameria.am/history → кнопка Filter справа → выставь даты → секция Actions → кнопка Excel
        </p>
        <input
          id="file-input"
          type="file"
          accept=".xls,.xlsx"
          style={{ display: 'none' }}
          onChange={(event) => readFile(event.target.files[0])}
        />
      </div>

      {error && <p className="expense">{error}</p>}

      {report && (
        <div className="panel" style={{ marginTop: 20 }}>
          <h3>Импорт завершён</h3>
          <p>
            Период: {formatDate(report.periodFrom)} — {formatDate(report.periodTo)}
          </p>
          <p>Строк в файле: {report.rows}</p>
          <p>Добавлено: {report.added}</p>
          <p>Дублей: {report.duplicates}</p>
          {report.unresolved > 0 && (
            <p className="expense">
              Требуют внимания: {report.unresolved} — ни один счёт операции не опознан как твой
            </p>
          )}
        </div>
      )}

      {needsConfirmation && (
        <div className="panel" style={{ marginTop: 20 }}>
          <h3>Найденные счета</h3>
          <p className="muted">
            Эти счета определены как твои. От них зависит, что считается доходом, а что расходом.
          </p>
          <ul>
            {detectedAccounts.map((account) => (
              <li key={account}>{maskAccount(account)}</li>
            ))}
          </ul>
          <button type="button" onClick={() => onConfirmAccounts(detectedAccounts)}>
            Подтвердить счета
          </button>
        </div>
      )}
    </div>
  )
}
```

`src/ui/Layout.jsx`:

```jsx
const SCREENS = [
  ['overview', 'Обзор'],
  ['categories', 'Категории'],
  ['transactions', 'Транзакции'],
  ['import', 'Импорт'],
  ['settings', 'Настройки'],
]

export function Layout({ screen, onNavigate, children }) {
  return (
    <div className="layout">
      <nav className="nav">
        {SCREENS.map(([id, title]) => (
          <button
            key={id}
            type="button"
            aria-current={screen === id}
            onClick={() => onNavigate(id)}
          >
            {title}
          </button>
        ))}
      </nav>
      {children}
    </div>
  )
}
```

`src/App.jsx` (переписать целиком):

```jsx
import { useEffect, useState } from 'react'
import './ui/theme.css'
import { Layout } from './ui/Layout.jsx'
import { ImportScreen } from './ui/ImportScreen.jsx'
import { importWorkbook } from './import/pipeline.js'
import { applyCategories } from './rules/match.js'
import { loadSettings, saveSettings } from './store/settings.js'
import { loadTransactions, saveTransactions } from './store/db.js'

export default function App() {
  const [screen, setScreen] = useState('import')
  const [settings, setSettings] = useState(() => loadSettings())
  const [transactions, setTransactions] = useState([])
  const [report, setReport] = useState(null)
  const [detectedAccounts, setDetectedAccounts] = useState([])
  const [error, setError] = useState(null)

  useEffect(() => {
    loadTransactions().then((stored) => {
      setTransactions(applyCategories(stored, settings))
      if (stored.length > 0) setScreen('overview')
    })
    // Настройки читаются один раз при старте; дальше состояние ведёт приложение.
  }, [])

  const updateSettings = (next) => {
    setSettings(next)
    saveSettings(next)
    setTransactions((current) => applyCategories(current, next))
  }

  const handleImport = async (bytes) => {
    try {
      setError(null)
      const result = importWorkbook(bytes, {
        existingTransactions: transactions,
        ownAccounts: settings.ownAccounts,
      })
      const categorized = applyCategories(result.transactions, settings)
      await saveTransactions(categorized)
      setTransactions(categorized)
      setDetectedAccounts(result.detectedAccounts)
      setReport(result.report)
    } catch (importError) {
      setError(importError.message)
    }
  }

  return (
    <Layout screen={screen} onNavigate={setScreen}>
      {screen === 'import' && (
        <ImportScreen
          onImport={handleImport}
          onConfirmAccounts={(accounts) => updateSettings({ ...settings, ownAccounts: accounts })}
          report={report}
          detectedAccounts={detectedAccounts}
          ownAccounts={settings.ownAccounts}
          error={error}
        />
      )}
      {screen !== 'import' && <p className="muted">Экран в разработке</p>}
    </Layout>
  )
}
```

- [ ] **Step 5: Запустить тесты — должны пройти**

Run: `npx vitest run src/ui/ImportScreen.test.jsx`
Expected: PASS, 4 теста

- [ ] **Step 6: Проверить в браузере**

Run: `npm run dev`, открыть, перетащить реальную выгрузку. Убедиться, что отчёт показывает период и число операций, а вкладка Network в инструментах разработчика остаётся пустой.

- [ ] **Step 7: Коммит**

```bash
git add src/App.jsx src/ui
git commit -m "Добавить каркас интерфейса и экран импорта"
```

---

### Task 18: Экран обзора и столбики по месяцам

**Files:**
- Create: `src/ui/charts/MonthBars.jsx`, `src/ui/OverviewScreen.jsx`
- Modify: `src/App.jsx` — подключить экран
- Test: `src/ui/OverviewScreen.test.jsx`

**Interfaces:**
- Consumes: `totals`, `byMonth`, `byCategory`, `formatAmd`, `formatMonth`
- Produces: `<OverviewScreen transactions categories />`, `<MonthBars months onSelect selected />`

- [ ] **Step 1: Написать падающий тест**

`src/ui/OverviewScreen.test.jsx`:

```js
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { OverviewScreen } from './OverviewScreen.jsx'
import { SEED_CATEGORIES } from '../rules/seed.js'

const tx = (over) => ({
  key: Math.random().toString(36), date: '2026-09-10', opType: 'Քարտային գործարք',
  fromAccount: 'MINE', toAccount: 'SHOP', counterparty: '', details: '', comment: '',
  status: 'Հաստատված', amount: 100000, currency: 'AMD', direction: 'expense',
  categoryId: 'groceries', ...over,
})

describe('OverviewScreen', () => {
  it('на пустых данных зовёт импортировать выгрузку', () => {
    render(<OverviewScreen transactions={[]} categories={SEED_CATEGORIES} />)
    expect(screen.getByText(/нет данных/i)).toBeTruthy()
  })

  it('показывает пришло, ушло и чистый результат', () => {
    const list = [tx({ amount: 300000 }), tx({ direction: 'income', amount: 500000, categoryId: 'salary' })]
    render(<OverviewScreen transactions={list} categories={SEED_CATEGORIES} />)
    expect(screen.getByTestId('total-income').textContent).toMatch(/5\u00A0000/)
    expect(screen.getByTestId('total-expense').textContent).toMatch(/3\u00A0000/)
    expect(screen.getByTestId('total-net').textContent).toMatch(/2\u00A0000/)
  })

  it('отдельной строкой показывает комиссии банка', () => {
    const list = [tx({ categoryId: 'fees', amount: 900 }), tx({ amount: 300000 })]
    render(<OverviewScreen transactions={list} categories={SEED_CATEGORIES} />)
    expect(screen.getByTestId('fees-total').textContent).toMatch(/9/)
  })

  it('называет категории человеческими именами', () => {
    render(<OverviewScreen transactions={[tx()]} categories={SEED_CATEGORIES} />)
    expect(screen.getByText('Продукты')).toBeTruthy()
  })
})
```

- [ ] **Step 2: Запустить тест и убедиться, что он падает**

Run: `npx vitest run src/ui/OverviewScreen.test.jsx`
Expected: FAIL — `Failed to resolve import "./OverviewScreen.jsx"`

- [ ] **Step 3: Реализовать столбики**

`src/ui/charts/MonthBars.jsx`:

```jsx
import { formatMonth } from '../format.js'

const WIDTH = 900
const HEIGHT = 220
const PADDING = 32

export function MonthBars({ months, selected, onSelect }) {
  if (months.length === 0) return null

  const peak = Math.max(...months.flatMap((m) => [m.income, m.expense]), 1)
  const slot = (WIDTH - PADDING * 2) / months.length
  const barWidth = Math.min(28, slot / 3)
  const scale = (value) => ((HEIGHT - PADDING * 2) * value) / peak

  return (
    <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} width="100%" role="img" aria-label="Доходы и расходы по месяцам">
      {months.map((month, index) => {
        const centre = PADDING + slot * index + slot / 2
        const baseline = HEIGHT - PADDING
        const isSelected = month.month === selected
        return (
          <g key={month.month} onClick={() => onSelect?.(month.month)} style={{ cursor: 'pointer' }}>
            <rect
              x={centre - barWidth - 2} y={baseline - scale(month.income)}
              width={barWidth} height={scale(month.income)} fill="var(--income)"
              opacity={isSelected ? 1 : 0.65}
            />
            <rect
              x={centre + 2} y={baseline - scale(month.expense)}
              width={barWidth} height={scale(month.expense)} fill="var(--expense)"
              opacity={isSelected ? 1 : 0.65}
            />
            <text
              x={centre} y={HEIGHT - 10} textAnchor="middle"
              fontSize="11" fill="var(--muted)"
            >
              {formatMonth(month.month).split(' ')[0].slice(0, 3)}
            </text>
          </g>
        )
      })}
    </svg>
  )
}
```

- [ ] **Step 4: Реализовать экран обзора**

`src/ui/OverviewScreen.jsx`:

```jsx
import { useMemo, useState } from 'react'
import { totals, byMonth, byCategory, countable } from '../stats/aggregate.js'
import { monthOf } from '../import/date.js'
import { MonthBars } from './charts/MonthBars.jsx'
import { formatAmd, formatMonth } from './format.js'

export function OverviewScreen({ transactions, categories }) {
  const months = useMemo(() => byMonth(transactions), [transactions])
  const [selected, setSelected] = useState(null)
  const activeMonth = selected ?? months[months.length - 1]?.month ?? null

  const inMonth = useMemo(
    () => (activeMonth ? transactions.filter((tx) => monthOf(tx.date) === activeMonth) : []),
    [transactions, activeMonth],
  )

  const monthTotals = totals(inMonth)
  const expenses = byCategory(inMonth, 'expense')
  const nameOf = (id) =>
    categories.find((category) => category.id === id)?.name ?? 'Без категории'
  const colourOf = (id) =>
    categories.find((category) => category.id === id)?.color ?? 'var(--muted)'
  const sumOf = (id) => expenses.find((row) => row.categoryId === id)?.amount ?? 0

  if (countable(transactions).length === 0) {
    return <p className="muted">Нет данных — импортируй выгрузку из myAmeria на вкладке «Импорт».</p>
  }

  return (
    <div>
      <div className="panel">
        <MonthBars months={months} selected={activeMonth} onSelect={setSelected} />
      </div>

      <h2>{activeMonth ? formatMonth(activeMonth) : ''}</h2>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
        <div className="panel">
          <div className="muted">Пришло</div>
          <div className="income" data-testid="total-income" style={{ fontSize: 24 }}>
            {formatAmd(monthTotals.income)}
          </div>
        </div>
        <div className="panel">
          <div className="muted">Ушло</div>
          <div className="expense" data-testid="total-expense" style={{ fontSize: 24 }}>
            {formatAmd(monthTotals.expense)}
          </div>
        </div>
        <div className="panel">
          <div className="muted">Осталось</div>
          <div data-testid="total-net" style={{ fontSize: 24 }}>
            {formatAmd(monthTotals.net)}
          </div>
        </div>
      </div>

      <div className="panel" style={{ marginTop: 12 }}>
        <div className="muted">То, что обычно не замечают</div>
        <p>
          Комиссии банка: <strong data-testid="fees-total">{formatAmd(sumOf('fees'))}</strong>
        </p>
        <p>
          Кредит с процентами:{' '}
          <strong>{formatAmd(sumOf('loan_principal') + sumOf('loan_interest'))}</strong>
        </p>
      </div>

      <div className="panel" style={{ marginTop: 12 }}>
        <h3>Куда ушли деньги</h3>
        <table>
          <tbody>
            {expenses.map((row) => (
              <tr key={row.categoryId ?? 'none'}>
                <td>
                  <span style={{
                    display: 'inline-block', width: 10, height: 10, borderRadius: 2,
                    background: colourOf(row.categoryId), marginRight: 8,
                  }} />
                  {nameOf(row.categoryId)}
                </td>
                <td className="num muted">{row.count}</td>
                <td className="num">{formatAmd(row.amount)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
```

- [ ] **Step 5: Подключить экран в `src/App.jsx`**

Заменить строку `{screen !== 'import' && <p className="muted">Экран в разработке</p>}` на:

```jsx
{screen === 'overview' && (
  <OverviewScreen transactions={transactions} categories={settings.categories} />
)}
{['categories', 'transactions', 'settings'].includes(screen) && (
  <p className="muted">Экран в разработке</p>
)}
```

И добавить импорт `import { OverviewScreen } from './ui/OverviewScreen.jsx'`.

- [ ] **Step 6: Запустить тесты — должны пройти**

Run: `npx vitest run src/ui/OverviewScreen.test.jsx`
Expected: PASS, 4 теста

- [ ] **Step 7: Коммит**

```bash
git add src/ui/OverviewScreen.jsx src/ui/OverviewScreen.test.jsx src/ui/charts src/App.jsx
git commit -m "Добавить экран обзора со столбиками по месяцам"
```

---

### Task 19: Фильтрация и экран транзакций

Отбор операций — это логика, а не интерфейс, поэтому он живёт отдельным модулем со своими тестами.

**Files:**
- Create: `src/stats/filter.js`, `src/ui/TransactionsScreen.jsx`
- Modify: `src/App.jsx`
- Test: `src/stats/filter.test.js`, `src/ui/TransactionsScreen.test.jsx`

**Interfaces:**
- Consumes: `normalizeMerchant`, `rulePreview`, `suggestRuleText`, `formatAmd`, `formatDate`
- Produces:
  - `filterTransactions(transactions, filters) => Transaction[]`, где `filters` = `{ query, from, to, categoryId, account, opType, direction, minAmount, maxAmount }` — любое поле необязательно
  - `<TransactionsScreen transactions categories onAssign onCreateRule />`

- [ ] **Step 1: Написать падающий тест фильтра**

`src/stats/filter.test.js`:

```js
import { describe, it, expect } from 'vitest'
import { filterTransactions } from './filter.js'

const tx = (over) => ({
  key: Math.random().toString(36), date: '2026-09-10', opType: 'Քարտային գործարք',
  fromAccount: 'MINE', toAccount: 'SHOP', counterparty: '«ԱՍԿ 23» ՍՊԸ',
  details: 'Ք: ASK 23 LLC YEREVAN AM 887772', comment: '', status: 'Հաստատված',
  amount: 100000, currency: 'AMD', direction: 'expense', categoryId: 'groceries', ...over,
})

describe('filterTransactions', () => {
  it('без фильтров возвращает всё', () => {
    expect(filterTransactions([tx(), tx()], {})).toHaveLength(2)
  })

  it('ищет по деталям, контрагенту и комментарию без учёта регистра', () => {
    const list = [tx(), tx({ details: 'нечто', counterparty: '', comment: 'такси' })]
    expect(filterTransactions(list, { query: 'ask 23' })).toHaveLength(1)
    expect(filterTransactions(list, { query: 'ТАКСИ' })).toHaveLength(1)
  })

  it('отбирает по периоду включительно', () => {
    const list = [tx({ date: '2026-09-01' }), tx({ date: '2026-09-10' }), tx({ date: '2026-09-20' })]
    expect(filterTransactions(list, { from: '2026-09-10', to: '2026-09-20' })).toHaveLength(2)
  })

  it('отбирает по сумме, категории, счёту, типу и направлению', () => {
    const list = [tx({ amount: 50000 }), tx({ amount: 500000, categoryId: 'cafe' })]
    expect(filterTransactions(list, { minAmount: 100000 })).toHaveLength(1)
    expect(filterTransactions(list, { maxAmount: 100000 })).toHaveLength(1)
    expect(filterTransactions(list, { categoryId: 'cafe' })).toHaveLength(1)
    expect(filterTransactions(list, { account: 'MINE' })).toHaveLength(2)
    expect(filterTransactions(list, { direction: 'income' })).toHaveLength(0)
    expect(filterTransactions(list, { opType: 'Քարտային գործարք' })).toHaveLength(2)
  })

  it('различает операции без категории и любые операции', () => {
    const list = [tx(), tx({ categoryId: null })]
    expect(filterTransactions(list, { categoryId: '__none__' })).toHaveLength(1)
  })

  it('соединяет фильтры по И', () => {
    const list = [tx({ amount: 500000 }), tx({ amount: 500000, categoryId: 'cafe' })]
    expect(filterTransactions(list, { minAmount: 100000, categoryId: 'cafe' })).toHaveLength(1)
  })
})
```

- [ ] **Step 2: Запустить тест и убедиться, что он падает**

Run: `npx vitest run src/stats/filter.test.js`
Expected: FAIL — `Failed to resolve import "./filter.js"`

- [ ] **Step 3: Реализовать фильтр**

`src/stats/filter.js`:

```js
export const NO_CATEGORY = '__none__'

export function filterTransactions(transactions, filters = {}) {
  const query = filters.query ? String(filters.query).toUpperCase() : null

  return transactions.filter((tx) => {
    if (query) {
      const haystack = `${tx.details} ${tx.counterparty} ${tx.comment}`.toUpperCase()
      if (!haystack.includes(query)) return false
    }
    if (filters.from && tx.date < filters.from) return false
    if (filters.to && tx.date > filters.to) return false
    if (filters.direction && tx.direction !== filters.direction) return false
    if (filters.opType && tx.opType !== filters.opType) return false
    if (filters.account && tx.fromAccount !== filters.account && tx.toAccount !== filters.account) {
      return false
    }
    if (filters.categoryId === NO_CATEGORY) {
      if (tx.categoryId) return false
    } else if (filters.categoryId && tx.categoryId !== filters.categoryId) {
      return false
    }
    if (filters.minAmount != null && tx.amount < filters.minAmount) return false
    if (filters.maxAmount != null && tx.amount > filters.maxAmount) return false
    return true
  })
}
```

- [ ] **Step 4: Написать падающий тест экрана**

`src/ui/TransactionsScreen.test.jsx`:

```js
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { TransactionsScreen } from './TransactionsScreen.jsx'
import { SEED_CATEGORIES } from '../rules/seed.js'

const tx = (over) => ({
  key: 'k1', date: '2026-09-10', opType: 'Քարտային գործարք', fromAccount: 'MINE',
  toAccount: 'SHOP', counterparty: '«ԱՍԿ 23» ՍՊԸ', details: 'Ք: ASK 23 LLC YEREVAN AM 887772',
  comment: '', status: 'Հաստատված', amount: 100000, currency: 'AMD',
  direction: 'expense', categoryId: null, ...over,
})

const noop = () => {}

describe('TransactionsScreen', () => {
  it('показывает операции и их суммы', () => {
    render(
      <TransactionsScreen transactions={[tx()]} categories={SEED_CATEGORIES}
        onAssign={noop} onCreateRule={noop} />,
    )
    expect(screen.getByText(/ASK 23 LLC/)).toBeTruthy()
    expect(screen.getByText(/1\u00A0000/)).toBeTruthy()
  })

  it('сужает список по поисковой строке', () => {
    render(
      <TransactionsScreen
        transactions={[tx(), tx({ key: 'k2', details: 'нечто другое', counterparty: '' })]}
        categories={SEED_CATEGORIES} onAssign={noop} onCreateRule={noop} />,
    )
    fireEvent.change(screen.getByPlaceholderText(/поиск/i), { target: { value: 'ASK' } })
    expect(screen.getAllByRole('row')).toHaveLength(2) // заголовок + одна операция
  })

  it('при выборе категории сообщает ключ операции', () => {
    const onAssign = vi.fn()
    render(
      <TransactionsScreen transactions={[tx()]} categories={SEED_CATEGORIES}
        onAssign={onAssign} onCreateRule={noop} />,
    )
    fireEvent.change(screen.getByTestId('assign-k1'), { target: { value: 'groceries' } })
    expect(onAssign).toHaveBeenCalledWith('k1', 'groceries')
  })

  it('предлагает создать правило и показывает, скольких операций оно коснётся', () => {
    const onCreateRule = vi.fn()
    render(
      <TransactionsScreen
        transactions={[tx(), tx({ key: 'k2', details: 'Ք: ASK 23 LLC YEREVAN AM 190677' })]}
        categories={SEED_CATEGORIES} onAssign={noop} onCreateRule={onCreateRule} />,
    )
    fireEvent.change(screen.getByTestId('assign-k1'), { target: { value: 'groceries' } })
    expect(screen.getByText(/затронет ещё 2/i)).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: /создать правило/i }))
    expect(onCreateRule).toHaveBeenCalledWith({ match: 'ASK 23 LLC YEREVAN AM', category: 'groceries' })
  })
})
```

- [ ] **Step 5: Реализовать экран транзакций**

`src/ui/TransactionsScreen.jsx`:

```jsx
import { useMemo, useState } from 'react'
import { filterTransactions, NO_CATEGORY } from '../stats/filter.js'
import { rulePreview } from '../rules/match.js'
import { suggestRuleText } from '../rules/normalize.js'
import { formatAmd, formatDate } from './format.js'

export function TransactionsScreen({ transactions, categories, onAssign, onCreateRule }) {
  const [filters, setFilters] = useState({})
  const [pendingRule, setPendingRule] = useState(null)

  const visible = useMemo(() => filterTransactions(transactions, filters), [transactions, filters])
  const set = (field) => (event) =>
    setFilters((current) => ({ ...current, [field]: event.target.value || undefined }))

  const assign = (tx, categoryId) => {
    if (!categoryId) return
    onAssign(tx.key, categoryId)
    const match = suggestRuleText(tx)
    if (match) setPendingRule({ match, category: categoryId })
  }

  const preview = pendingRule ? rulePreview(transactions, pendingRule) : null

  return (
    <div>
      <div className="panel" style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <input placeholder="Поиск по деталям" onChange={set('query')} />
        <input type="date" onChange={set('from')} />
        <input type="date" onChange={set('to')} />
        <select onChange={set('direction')}>
          <option value="">Все направления</option>
          <option value="expense">Расходы</option>
          <option value="income">Доходы</option>
          <option value="internal">Между своими счетами</option>
          <option value="unresolved">Требуют внимания</option>
        </select>
        <select onChange={set('categoryId')}>
          <option value="">Все категории</option>
          <option value={NO_CATEGORY}>Без категории</option>
          {categories.map((category) => (
            <option key={category.id} value={category.id}>{category.name}</option>
          ))}
        </select>
      </div>

      {pendingRule && preview && (
        <div className="panel" style={{ marginTop: 12 }}>
          <p>
            Правило «{pendingRule.match}» затронет ещё {preview.count} операций
            на {formatAmd(preview.amount)}.
          </p>
          <button type="button" onClick={() => { onCreateRule(pendingRule); setPendingRule(null) }}>
            Создать правило
          </button>
          <button type="button" onClick={() => setPendingRule(null)}>Не надо</button>
        </div>
      )}

      <div className="panel" style={{ marginTop: 12 }}>
        <table>
          <thead>
            <tr>
              <th>Дата</th>
              <th>Детали</th>
              <th>Категория</th>
              <th className="num">Сумма</th>
            </tr>
          </thead>
          <tbody>
            {visible.map((tx) => (
              <tr key={tx.key}>
                <td className="muted">{formatDate(tx.date)}</td>
                <td>
                  {tx.details || tx.counterparty}
                  <div className="muted" style={{ fontSize: 12 }}>{tx.opType}</div>
                </td>
                <td>
                  <select
                    data-testid={`assign-${tx.key}`}
                    value={tx.categoryId ?? ''}
                    onChange={(event) => assign(tx, event.target.value)}
                  >
                    <option value="">Без категории</option>
                    {categories.map((category) => (
                      <option key={category.id} value={category.id}>{category.name}</option>
                    ))}
                  </select>
                </td>
                <td className={`num ${tx.direction === 'income' ? 'income' : 'expense'}`}>
                  {formatAmd(tx.amount)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
```

- [ ] **Step 6: Подключить экран в `src/App.jsx`**

Добавить импорт `import { TransactionsScreen } from './ui/TransactionsScreen.jsx'` и обработчики:

```jsx
const handleAssign = (key, categoryId) =>
  updateSettings({ ...settings, overrides: { ...settings.overrides, [key]: categoryId } })

const handleCreateRule = (rule) =>
  updateSettings({ ...settings, rules: [rule, ...settings.rules] })
```

И ветку экрана:

```jsx
{screen === 'transactions' && (
  <TransactionsScreen
    transactions={transactions}
    categories={settings.categories}
    onAssign={handleAssign}
    onCreateRule={handleCreateRule}
  />
)}
```

- [ ] **Step 7: Запустить тесты — должны пройти**

Run: `npx vitest run src/stats/filter.test.js src/ui/TransactionsScreen.test.jsx`
Expected: PASS, 10 тестов

- [ ] **Step 8: Коммит**

```bash
git add src/stats/filter.js src/stats/filter.test.js src/ui/TransactionsScreen.jsx src/ui/TransactionsScreen.test.jsx src/App.jsx
git commit -m "Добавить фильтрацию и экран транзакций с созданием правил"
```

---

### Task 20: Экран категорий, бюджеты и очередь разбора

Очередь разбора отсортирована по убыванию суммы: на реальных данных неразобранные 33% операций держат больше денег, чем разобранные 67%, поэтому разбирать их надо сверху.

**Files:**
- Create: `src/ui/CategoriesScreen.jsx`, `src/ui/charts/CategoryBars.jsx`
- Modify: `src/ui/TransactionsScreen.jsx` — принимать начальные фильтры и сортировку
- Modify: `src/App.jsx`
- Test: `src/ui/CategoriesScreen.test.jsx`

**Interfaces:**
- Consumes: `byCategory`, `uncategorized`, `budgetProgress`, `totals`
- Produces: `<CategoriesScreen transactions categories budgets month onChangeBudget onShowUncategorized />`, `<CategoryBars rows categories />`

- [ ] **Step 1: Дополнить `TransactionsScreen` начальными фильтрами и сортировкой**

В `src/ui/TransactionsScreen.jsx` заменить сигнатуру и состояние:

```jsx
export function TransactionsScreen({
  transactions, categories, onAssign, onCreateRule, initialFilters = {}, initialSort = 'date',
}) {
  const [filters, setFilters] = useState(initialFilters)
  const [sort, setSort] = useState(initialSort)

  const visible = useMemo(() => {
    const rows = filterTransactions(transactions, filters)
    return sort === 'amount'
      ? [...rows].sort((a, b) => b.amount - a.amount)
      : [...rows].sort((a, b) => b.date.localeCompare(a.date))
  }, [transactions, filters, sort])
```

И добавить в панель фильтров переключатель сортировки:

```jsx
<select value={sort} onChange={(event) => setSort(event.target.value)} aria-label="Сортировка">
  <option value="date">Сначала свежие</option>
  <option value="amount">Сначала крупные</option>
</select>
```

- [ ] **Step 2: Написать падающий тест экрана категорий**

`src/ui/CategoriesScreen.test.jsx`:

```js
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { CategoriesScreen } from './CategoriesScreen.jsx'
import { SEED_CATEGORIES } from '../rules/seed.js'

const tx = (over) => ({
  key: Math.random().toString(36), date: '2026-09-10', opType: 'Քարտային գործարք',
  fromAccount: 'MINE', toAccount: 'SHOP', counterparty: '', details: '', comment: '',
  status: 'Հաստատված', amount: 100000, currency: 'AMD', direction: 'expense',
  categoryId: 'groceries', ...over,
})

const props = {
  categories: SEED_CATEGORIES,
  budgets: {},
  month: '2026-09',
  today: '2026-09-10',
  onChangeBudget: () => {},
  onShowUncategorized: () => {},
}

describe('CategoriesScreen', () => {
  it('показывает траты по категориям', () => {
    render(<CategoriesScreen {...props} transactions={[tx()]} />)
    // Имя категории и сумма встречаются и в полосах, и в таблице бюджетов,
    // поэтому проверяем наличие, а не единственность.
    expect(screen.getAllByText('Продукты').length).toBeGreaterThan(0)
    expect(screen.getAllByText(/1\u00A0000/).length).toBeGreaterThan(0)
  })

  it('показывает бюджет, факт и прогноз', () => {
    render(
      <CategoriesScreen {...props} budgets={{ groceries: 300000 }}
        transactions={[tx({ amount: 50000, date: '2026-09-01' })]} />,
    )
    expect(screen.getByTestId('budget-groceries-spent').textContent).toMatch(/500/)
    expect(screen.getByTestId('budget-groceries-projected').textContent).toMatch(/1\u00A0500/)
  })

  it('предупреждает о дне перерасхода', () => {
    render(
      <CategoriesScreen {...props} budgets={{ groceries: 100000 }}
        transactions={[tx({ amount: 50000, date: '2026-09-01' })]} />,
    )
    expect(screen.getByTestId('budget-groceries-overrun').textContent).toMatch(/20/)
  })

  it('сообщает, сколько денег осталось без категории, и ведёт разбирать', () => {
    const onShowUncategorized = vi.fn()
    render(
      <CategoriesScreen {...props} onShowUncategorized={onShowUncategorized}
        transactions={[tx({ categoryId: null, amount: 900000 })]} />,
    )
    expect(screen.getByTestId('uncategorized-summary').textContent).toMatch(/9\u00A0000/)
    fireEvent.click(screen.getByRole('button', { name: /разобрать/i }))
    expect(onShowUncategorized).toHaveBeenCalled()
  })

  it('меняет лимит бюджета', () => {
    const onChangeBudget = vi.fn()
    render(
      <CategoriesScreen {...props} budgets={{ groceries: 300000 }}
        onChangeBudget={onChangeBudget} transactions={[tx()]} />,
    )
    fireEvent.change(screen.getByTestId('budget-groceries-limit'), { target: { value: '5000' } })
    expect(onChangeBudget).toHaveBeenCalledWith('groceries', 500000)
  })
})
```

- [ ] **Step 3: Реализовать полосы по категориям**

`src/ui/charts/CategoryBars.jsx`:

```jsx
import { formatAmd } from '../format.js'

export function CategoryBars({ rows, categories }) {
  if (rows.length === 0) return null
  const peak = Math.max(...rows.map((row) => row.amount), 1)
  const nameOf = (id) => categories.find((c) => c.id === id)?.name ?? 'Без категории'
  const colourOf = (id) => categories.find((c) => c.id === id)?.color ?? '#868e96'

  return (
    <div>
      {rows.map((row) => (
        <div key={row.categoryId ?? 'none'} style={{ marginBottom: 10 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14 }}>
            <span>{nameOf(row.categoryId)}</span>
            <span>{formatAmd(row.amount)}</span>
          </div>
          <div style={{ background: 'var(--line)', borderRadius: 3, height: 8 }}>
            <div style={{
              width: `${(row.amount / peak) * 100}%`, height: '100%',
              background: colourOf(row.categoryId), borderRadius: 3,
            }} />
          </div>
        </div>
      ))}
    </div>
  )
}
```

- [ ] **Step 4: Реализовать экран категорий**

`src/ui/CategoriesScreen.jsx`:

```jsx
import { useMemo } from 'react'
import { byCategory, uncategorized } from '../stats/aggregate.js'
import { budgetProgress } from '../stats/budget.js'
import { monthOf } from '../import/date.js'
import { CategoryBars } from './charts/CategoryBars.jsx'
import { formatAmd } from './format.js'

export function CategoriesScreen({
  transactions, categories, budgets, month, today, onChangeBudget, onShowUncategorized,
}) {
  const inMonth = useMemo(
    () => transactions.filter((tx) => monthOf(tx.date) === month),
    [transactions, month],
  )
  const rows = byCategory(inMonth, 'expense')
  const pending = uncategorized(transactions)
  const pendingAmount = pending.reduce((acc, tx) => acc + tx.amount, 0)
  const progress = budgetProgress(transactions, budgets, month, today)
  const nameOf = (id) => categories.find((c) => c.id === id)?.name ?? id

  return (
    <div>
      <div className="panel">
        <h3>Расходы по категориям</h3>
        <CategoryBars rows={rows} categories={categories} />
      </div>

      {pending.length > 0 && (
        <div className="panel" style={{ marginTop: 12 }}>
          <h3>Без категории</h3>
          <p data-testid="uncategorized-summary">
            {pending.length} операций на {formatAmd(pendingAmount)}. Начни с самых крупных —
            в них лежит почти весь неопознанный оборот.
          </p>
          <button type="button" onClick={onShowUncategorized}>Разобрать</button>
        </div>
      )}

      <div className="panel" style={{ marginTop: 12 }}>
        <h3>Бюджеты</h3>
        <table>
          <thead>
            <tr>
              <th>Категория</th>
              <th className="num">Лимит, ֏</th>
              <th className="num">Потрачено</th>
              <th className="num">Прогноз</th>
              <th>Перерасход</th>
            </tr>
          </thead>
          <tbody>
            {categories.map((category) => {
              const row = progress.find((item) => item.categoryId === category.id)
              const limit = budgets[category.id] ?? 0
              return (
                <tr key={category.id}>
                  <td>{nameOf(category.id)}</td>
                  <td className="num">
                    <input
                      data-testid={`budget-${category.id}-limit`}
                      type="number"
                      value={Math.round(limit / 100)}
                      style={{ width: 90 }}
                      onChange={(event) =>
                        onChangeBudget(category.id, Math.round(Number(event.target.value) * 100))
                      }
                    />
                  </td>
                  <td className="num" data-testid={`budget-${category.id}-spent`}>
                    {formatAmd(row?.spent ?? 0)}
                  </td>
                  <td className="num" data-testid={`budget-${category.id}-projected`}>
                    {formatAmd(row?.projectedTotal ?? 0)}
                  </td>
                  <td className="expense" data-testid={`budget-${category.id}-overrun`}>
                    {row?.overrunDay ? `с ${row.overrunDay}-го числа` : ''}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
```

- [ ] **Step 5: Подключить экран в `src/App.jsx`**

Добавить импорт `import { CategoriesScreen } from './ui/CategoriesScreen.jsx'`, состояние
`const [transactionsPreset, setTransactionsPreset] = useState({ filters: {}, sort: 'date' })`
и ветку:

```jsx
{screen === 'categories' && (
  <CategoriesScreen
    transactions={transactions}
    categories={settings.categories}
    budgets={settings.budgets}
    month={byMonth(transactions).slice(-1)[0]?.month ?? new Date().toISOString().slice(0, 7)}
    today={new Date().toISOString().slice(0, 10)}
    onChangeBudget={(categoryId, limit) =>
      updateSettings({ ...settings, budgets: { ...settings.budgets, [categoryId]: limit } })}
    onShowUncategorized={() => {
      setTransactionsPreset({ filters: { categoryId: NO_CATEGORY }, sort: 'amount' })
      setScreen('transactions')
    }}
  />
)}
```

Экран транзакций получает пресет:

```jsx
<TransactionsScreen
  key={`${transactionsPreset.sort}-${transactionsPreset.filters.categoryId ?? ''}`}
  transactions={transactions}
  categories={settings.categories}
  onAssign={handleAssign}
  onCreateRule={handleCreateRule}
  initialFilters={transactionsPreset.filters}
  initialSort={transactionsPreset.sort}
/>
```

Импортировать `byMonth` из `./stats/aggregate.js` и `NO_CATEGORY` из `./stats/filter.js`.
Атрибут `key` нужен, чтобы экран пересоздавался при смене пресета и подхватывал новые
начальные фильтры.

- [ ] **Step 6: Запустить тесты — должны пройти**

Run: `npx vitest run src/ui/CategoriesScreen.test.jsx src/ui/TransactionsScreen.test.jsx`
Expected: PASS, 9 тестов

- [ ] **Step 7: Коммит**

```bash
git add src/ui/CategoriesScreen.jsx src/ui/CategoriesScreen.test.jsx src/ui/charts/CategoryBars.jsx src/ui/TransactionsScreen.jsx src/App.jsx
git commit -m "Добавить экран категорий с бюджетами и очередью разбора"
```

---

### Task 21: Экран настроек и обмен rules.json

**Files:**
- Create: `src/ui/SettingsScreen.jsx`
- Modify: `src/App.jsx`
- Test: `src/ui/SettingsScreen.test.jsx`

**Interfaces:**
- Consumes: `serializeSettings`, `parseSettings`, `maskAccount`
- Produces: `<SettingsScreen settings onChange />`

- [ ] **Step 1: Написать падающий тест**

`src/ui/SettingsScreen.test.jsx`:

```js
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { SettingsScreen } from './SettingsScreen.jsx'
import { defaultSettings } from '../store/settings.js'

beforeEach(() => {
  localStorage.clear()
  URL.createObjectURL = vi.fn(() => 'blob:fake')
  URL.revokeObjectURL = vi.fn()
})

describe('SettingsScreen', () => {
  it('показывает подтверждённые счета в замаскированном виде', () => {
    const settings = { ...defaultSettings(), ownAccounts: ['1570000000000001'] }
    render(<SettingsScreen settings={settings} onChange={() => {}} />)
    expect(screen.getByText('1570…0001')).toBeTruthy()
  })

  it('удаляет счёт из списка своих', () => {
    const onChange = vi.fn()
    const settings = { ...defaultSettings(), ownAccounts: ['A1', 'A2'] }
    render(<SettingsScreen settings={settings} onChange={onChange} />)
    fireEvent.click(screen.getByTestId('remove-account-A1'))
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ ownAccounts: ['A2'] }))
  })

  it('поднимает правило выше по списку — порядок определяет приоритет', () => {
    const onChange = vi.fn()
    const settings = {
      ...defaultSettings(),
      rules: [{ match: 'A', category: 'cafe' }, { match: 'B', category: 'groceries' }],
    }
    render(<SettingsScreen settings={settings} onChange={onChange} />)
    fireEvent.click(screen.getByTestId('rule-up-1'))
    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({
        rules: [{ match: 'B', category: 'groceries' }, { match: 'A', category: 'cafe' }],
      }),
    )
  })

  it('удаляет правило', () => {
    const onChange = vi.fn()
    const settings = { ...defaultSettings(), rules: [{ match: 'A', category: 'cafe' }] }
    render(<SettingsScreen settings={settings} onChange={onChange} />)
    fireEvent.click(screen.getByTestId('rule-remove-0'))
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ rules: [] }))
  })

  it('выгружает rules.json файлом', () => {
    render(<SettingsScreen settings={defaultSettings()} onChange={() => {}} />)
    fireEvent.click(screen.getByRole('button', { name: /выгрузить rules\.json/i }))
    expect(URL.createObjectURL).toHaveBeenCalled()
  })

  it('сообщает, если загружаемый файл настроек испорчен', async () => {
    render(<SettingsScreen settings={defaultSettings()} onChange={() => {}} />)
    const input = screen.getByTestId('settings-file')
    const file = new File(['не json'], 'rules.json', { type: 'application/json' })
    Object.defineProperty(input, 'files', { value: [file] })
    fireEvent.change(input)
    expect(await screen.findByText(/не удалось разобрать/i)).toBeTruthy()
  })
})
```

- [ ] **Step 2: Запустить тест и убедиться, что он падает**

Run: `npx vitest run src/ui/SettingsScreen.test.jsx`
Expected: FAIL — `Failed to resolve import "./SettingsScreen.jsx"`

- [ ] **Step 3: Реализовать экран настроек**

`src/ui/SettingsScreen.jsx`:

```jsx
import { useState } from 'react'
import { serializeSettings, parseSettings } from '../store/settings.js'
import { maskAccount } from './format.js'

export function SettingsScreen({ settings, onChange }) {
  const [error, setError] = useState(null)

  const removeAccount = (account) =>
    onChange({ ...settings, ownAccounts: settings.ownAccounts.filter((item) => item !== account) })

  const moveRule = (index, delta) => {
    const rules = [...settings.rules]
    const target = index + delta
    if (target < 0 || target >= rules.length) return
    ;[rules[index], rules[target]] = [rules[target], rules[index]]
    onChange({ ...settings, rules })
  }

  const removeRule = (index) =>
    onChange({ ...settings, rules: settings.rules.filter((_, i) => i !== index) })

  // Скачивание через Blob — это работа с локальным файлом, а не сетевой запрос.
  const exportSettings = () => {
    const blob = new Blob([serializeSettings(settings)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = 'rules.json'
    link.click()
    URL.revokeObjectURL(url)
  }

  const importSettings = (file) => {
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => {
      try {
        setError(null)
        onChange(parseSettings(String(reader.result)))
      } catch (parseError) {
        setError(parseError.message)
      }
    }
    reader.readAsText(file)
  }

  const nameOf = (id) => settings.categories.find((c) => c.id === id)?.name ?? id

  return (
    <div>
      <div className="panel">
        <h3>Мои счета</h3>
        <p className="muted">
          От этого списка зависит, что считается доходом, что расходом, а что —
          перекладыванием денег между своими счетами.
        </p>
        <ul>
          {settings.ownAccounts.map((account) => (
            <li key={account}>
              {maskAccount(account)}{' '}
              <button
                type="button"
                data-testid={`remove-account-${account}`}
                onClick={() => removeAccount(account)}
              >
                убрать
              </button>
            </li>
          ))}
        </ul>
      </div>

      <div className="panel" style={{ marginTop: 12 }}>
        <h3>Правила категорий</h3>
        <p className="muted">Срабатывает первое подходящее правило сверху.</p>
        <table>
          <tbody>
            {settings.rules.map((rule, index) => (
              <tr key={`${rule.match}-${index}`}>
                <td>{rule.match}</td>
                <td>{nameOf(rule.category)}</td>
                <td className="muted">{rule.direction ?? ''}</td>
                <td>
                  <button type="button" data-testid={`rule-up-${index}`} onClick={() => moveRule(index, -1)}>
                    вверх
                  </button>
                  <button type="button" data-testid={`rule-remove-${index}`} onClick={() => removeRule(index)}>
                    удалить
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="panel" style={{ marginTop: 12 }}>
        <h3>Разметка</h3>
        <p className="muted">
          Транзакции всегда можно выгрузить из банка заново, а ручную разметку — нет.
          Держи rules.json в репозитории.
        </p>
        <button type="button" onClick={exportSettings}>Выгрузить rules.json</button>
        <input
          data-testid="settings-file"
          type="file"
          accept="application/json,.json"
          onChange={(event) => importSettings(event.target.files[0])}
        />
        {error && <p className="expense">{error}</p>}
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Подключить экран в `src/App.jsx`**

Добавить импорт `import { SettingsScreen } from './ui/SettingsScreen.jsx'` и ветку:

```jsx
{screen === 'settings' && (
  <SettingsScreen settings={settings} onChange={updateSettings} />
)}
```

Удалить оставшуюся заглушку «Экран в разработке».

- [ ] **Step 5: Запустить всю тестовую базу**

Run: `npx vitest run`
Expected: PASS, все тесты

- [ ] **Step 6: Проверить в браузере на реальных данных**

Run: `npm run dev`

1. Импортировать реальную выгрузку, подтвердить счета.
2. Обзор: сверить «пришло минус ушло» с ожидаемым.
3. Категории: убедиться, что очередь разбора отсортирована по убыванию суммы.
4. Транзакции: разметить одну операцию, создать из неё правило, убедиться, что оно применилось задним числом.
5. Настройки: выгрузить `rules.json`, положить в корень репозитория вместо пустого.
6. **Открыть вкладку Network и перезагрузить страницу — запросов к внешним адресам быть не должно.**

- [ ] **Step 7: Коммит**

```bash
git add src/ui/SettingsScreen.jsx src/ui/SettingsScreen.test.jsx src/App.jsx rules.json
git commit -m "Добавить экран настроек с обменом rules.json"
```

---

### Task 22: Раздельный учёт по валютам

Спека (раздел 10) требует считать статистику по валютам раздельно: курсов в файле банк не даёт, поэтому складывать AMD с USD нельзя ни при каких условиях. Сейчас у пользователя всё в AMD, но молча просуммировать разные валюты хуже, чем громко отказаться, — поэтому агрегаты будут падать с внятной ошибкой, если валюта не задана, а их в данных несколько.

**Files:**
- Modify: `src/stats/aggregate.js`
- Modify: `src/stats/budget.js` — пробросить валюту
- Modify: `src/App.jsx` — переключатель валют, видимый только когда валют больше одной
- Test: `src/stats/currency.test.js`

**Interfaces:**
- Consumes: ничего нового
- Produces:
  - `currenciesOf(transactions) => string[]` — отсортированный список валют
  - `countable(transactions, currency = null)` — фильтрует по валюте; бросает исключение, если валют несколько, а валюта не указана
  - `totals`, `byMonth`, `byMerchant`, `uncategorized` принимают `currency` последним аргументом
  - `byCategory(transactions, direction = 'expense', currency = null)`
  - `budgetProgress(transactions, budgets, month, today, currency = null)`

- [ ] **Step 1: Написать падающий тест**

`src/stats/currency.test.js`:

```js
import { describe, it, expect } from 'vitest'
import { currenciesOf, countable, totals, byCategory } from './aggregate.js'
import { budgetProgress } from './budget.js'

const tx = (over) => ({
  key: Math.random().toString(36), date: '2026-09-10', opType: 'Քարտային գործարք',
  fromAccount: 'MINE', toAccount: 'SHOP', counterparty: '', details: '', comment: '',
  status: 'Հաստատված', amount: 100000, currency: 'AMD', direction: 'expense',
  categoryId: 'groceries', ...over,
})

const mixed = [tx({ amount: 300000 }), tx({ amount: 5000, currency: 'USD' })]

describe('валюты', () => {
  it('перечисляет валюты, встреченные в данных', () => {
    expect(currenciesOf(mixed)).toEqual(['AMD', 'USD'])
  })

  it('на одной валюте ничего не требует', () => {
    expect(totals([tx()]).expense).toBe(100000)
  })

  it('отказывается складывать разные валюты без явного выбора', () => {
    expect(() => countable(mixed)).toThrow(/валют/)
    expect(() => totals(mixed)).toThrow(/валют/)
  })

  it('считает по выбранной валюте', () => {
    expect(totals(mixed, 'AMD').expense).toBe(300000)
    expect(totals(mixed, 'USD').expense).toBe(5000)
  })

  it('фильтрует по валюте и в разрезе категорий', () => {
    expect(byCategory(mixed, 'expense', 'USD')).toEqual([
      { categoryId: 'groceries', amount: 5000, count: 1 },
    ])
  })

  it('бюджеты считаются в выбранной валюте', () => {
    const rows = budgetProgress(mixed, { groceries: 10000 }, '2026-09', '2026-09-10', 'USD')
    expect(rows[0].spent).toBe(5000)
  })
})
```

- [ ] **Step 2: Запустить тест и убедиться, что он падает**

Run: `npx vitest run src/stats/currency.test.js`
Expected: FAIL — `currenciesOf is not a function`

- [ ] **Step 3: Научить агрегаты работать с валютой**

В `src/stats/aggregate.js` заменить `countable` и добавить `currenciesOf`, затем пробросить
валюту во все агрегаты:

```js
export function currenciesOf(transactions) {
  const found = new Set()
  for (const tx of transactions) {
    if (tx.status === STATUS_APPROVED && COUNTABLE_DIRECTIONS.has(tx.direction)) {
      found.add(tx.currency)
    }
  }
  return Array.from(found).sort()
}

// Курсов в выгрузке банка нет, поэтому складывать разные валюты нельзя.
// Если валют несколько, а какая нужна — не сказано, это ошибка, а не повод угадывать.
export function countable(transactions, currency = null) {
  const rows = transactions.filter(
    (tx) => tx.status === STATUS_APPROVED && COUNTABLE_DIRECTIONS.has(tx.direction),
  )
  if (currency) return rows.filter((tx) => tx.currency === currency)

  const currencies = new Set(rows.map((tx) => tx.currency))
  if (currencies.size > 1) {
    throw new Error(
      `В данных несколько валют (${Array.from(currencies).sort().join(', ')}). ` +
        'Курсов банк не даёт, поэтому нужно выбрать валюту.',
    )
  }
  return rows
}
```

Дальше во всех агрегатах заменить `countable(transactions)` на `countable(transactions, currency)`
и добавить параметр в сигнатуры:

```js
export function totals(transactions, currency = null) { /* ...countable(transactions, currency)... */ }
export function byMonth(transactions, currency = null) { /* ... */ }
function groupBy(transactions, direction, keyOf, keyName, currency) { /* ... */ }
export function byCategory(transactions, direction = 'expense', currency = null) {
  return groupBy(transactions, direction, (tx) => tx.categoryId ?? null, 'categoryId', currency)
}
export function byMerchant(transactions, direction = 'expense', currency = null) {
  return groupBy(transactions, direction, (tx) => normalizeMerchant(tx.details), 'merchant', currency)
}
export function uncategorized(transactions, currency = null) { /* ... */ }
```

В `src/stats/budget.js` добавить последним параметром `currency = null` и передать его
в `countable(transactions, currency)`.

- [ ] **Step 4: Запустить тесты — должны пройти**

Run: `npx vitest run src/stats`
Expected: PASS — новый файл и все прежние тесты агрегатов и бюджетов

- [ ] **Step 5: Подключить выбор валюты в `src/App.jsx`**

```jsx
const currencies = useMemo(() => currenciesOf(transactions), [transactions])
const [currency, setCurrency] = useState(null)
const activeCurrency = currency ?? currencies[0] ?? null
```

Переключатель показывается только когда валют больше одной — пока у тебя всё в AMD,
интерфейс не засоряется:

```jsx
{currencies.length > 1 && (
  <select value={activeCurrency ?? ''} onChange={(event) => setCurrency(event.target.value)}>
    {currencies.map((code) => <option key={code} value={code}>{code}</option>)}
  </select>
)}
```

`activeCurrency` передаётся в `OverviewScreen` и `CategoriesScreen` и далее в агрегаты.
Импортировать `currenciesOf` из `./stats/aggregate.js`.

- [ ] **Step 6: Прогнать всю тестовую базу**

Run: `npx vitest run`
Expected: PASS, все тесты

- [ ] **Step 7: Коммит**

```bash
git add src/stats src/App.jsx
git commit -m "Считать статистику по валютам раздельно и не складывать разные валюты"
```

---

## Порядок выполнения

Задачи 1–16 — чистая логика, выполняются строго по порядку: каждая опирается на предыдущие.
Задачи 17–21 — интерфейс, тоже по порядку (каждая подключает свой экран в `App.jsx`).
Задача 22 меняет сигнатуры агрегатов, поэтому идёт после всех экранов, которые их вызывают.

Задача 15 требует твоей реальной выгрузки в `~/Downloads`. Входной файл не коммитится
никогда — в репозиторий попадает только обезличенный результат.
