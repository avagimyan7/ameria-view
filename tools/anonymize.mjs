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

// Внутри сохранённых бизнес-строк тоже могут прятаться персональные идентификаторы
// (номер телефона в описании платежа за связь, хеш транзакции и т. п.). Это не то же
// самое, что хвостовой номер референса карточной покупки вида "ASK 23 LLC YEREVAN AM
// 887772" — тот стоит в самом конце строки, синтетический и меняется от операции к
// операции, поэтому его трогать нельзя: он и делает похожие покупки уникальными по
// тексту. Отличаем одно от другого по позиции: хвостовой референс ничем не завершается
// (за ним больше нет символов), поэтому digit-lookahead его не трогает.
const HEX_TOKEN = /\b(?=[0-9a-f]*[a-f])[0-9a-f]{6,}\b/gi
// (?!\d) forces the match onto the full digit run (no shorter match wins by backtracking),
// (?=.) then requires at least one more character after that full run — i.e. it is not the
// very last thing in the string, which is exactly the trailing card-reference shape.
const EMBEDDED_DIGITS = /\d{5,}(?!\d)(?=.)/g
const IDENTIFIER_PLACEHOLDER = 'REF'

function scrubEmbeddedIdentifiers(value) {
  return value.replace(HEX_TOKEN, IDENTIFIER_PLACEHOLDER).replace(EMBEDDED_DIGITS, IDENTIFIER_PLACEHOLDER)
}

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
  if (isBusiness(value)) return scrubEmbeddedIdentifiers(value)
  const prefix = CARD_PREFIX.exec(value)?.[1] ?? ''
  const suffix = TRAILING_REF.exec(value)?.[1] ?? ''
  const core = value.slice(prefix.length, value.length - suffix.length)
  // suffix — это хвостовой референс карточной сети (код авторизации конкретной
  // операции), а не что-либо, привязанное к владельцу счёта. Он намеренно
  // сохраняется как есть: именно он делает текстовое представление похожих
  // покупок разными, а от этого зависит утверждение теста об уникальности
  // 254 ключей транзакций. Обезличивается только распознанное как персональное
  // имя (core), не референс.
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
    // Шапка банка (телефон, email и адрес банка, диапазон дат, заголовок отчёта,
    // ФИО владельца) не несёт никакой тестовой ценности: toNamedRows() эти строки
    // вообще не разбирает, а только ищет среди них строку с "Ամսաթիվ". Поэтому
    // реальный текст сюда не пропускаем совсем — даже то, что сегодня выглядит
    // безобидным (адрес банка, диапазон дат) — а заменяем фиксированной заглушкой,
    // вместо того чтобы полагаться на побочный эффект «сохраняем только колонку A».
    return [index === 4 ? 'TEST USER' : 'BANK LETTERHEAD']
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

// Самопроверка перед записью файла: инструмент не должен доверять собственной
// классификации того, что он только что сделал (это и было причиной двух предыдущих
// утечек — проверка смотрела на те же данные, что и сам классификатор, и поэтому не
// могла увидеть его ошибки). Здесь сканируется уже готовый результат целиком, без
// оглядки на то, что anonymizeText считает персональным, а что бизнес-названием.
//
// Хвостовой референс карточной операции (см. комментарий в anonymizeText) намеренно
// исключён не отдельным условием, а самой формой паттернов ниже: он всегда чисто
// десятичный и не длиннее 6 цифр в этой выгрузке, поэтому не может совпасть ни с одним
// из них — телефонный паттерн требует ровно 9 цифр, начинающихся с "0", а IBAN- и
// hex-паттерны требуют букв, которых в референсе нет.
const LEAK_PATTERNS = [
  { name: 'email', pattern: /[\w.+-]+@[\w-]+\.[\w.]+/ },
  { name: 'армянский мобильный номер (0XXXXXXXX)', pattern: /\b0\d{8}\b/ },
  { name: 'международный телефон (+374...)', pattern: /\+374\d+/ },
  { name: 'похоже на IBAN', pattern: /\b[A-Z]{2}\d{2}[A-Z0-9]{10,}\b/ },
  { name: 'похоже на hex-идентификатор', pattern: /\b(?=[0-9a-f]*[a-f])[0-9a-f]{6,}\b/i },
]

function findLeaks(rows) {
  const leaks = []
  for (const row of rows) {
    for (const cell of row) {
      if (typeof cell !== 'string' || !cell) continue
      for (const { name, pattern } of LEAK_PATTERNS) {
        const match = pattern.exec(cell)
        if (match) leaks.push({ name, cell, match: match[0] })
      }
    }
  }
  return leaks
}

const leaks = findLeaks(output)
if (leaks.length > 0) {
  console.error(
    `Самопроверка не пройдена: в результате остались ${leaks.length} вероятных идентификаторов. Файл не записан.`,
  )
  for (const leak of leaks) {
    console.error(`  [${leak.name}] совпадение ${JSON.stringify(leak.match)} в ${JSON.stringify(leak.cell)}`)
  }
  process.exit(1)
}

writeFileSync(outputPath, buildWorkbook(output))
console.log(`Готово: ${output.length} строк -> ${outputPath}`)
