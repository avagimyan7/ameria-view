import baseline from '../../rules.json'
import { SEED_CATEGORIES, SEED_RULES, SEED_OPTYPE_CATEGORIES } from '../rules/seed.js'

export const SETTINGS_VERSION = 1
const STORAGE_KEY = 'ameria-view:settings'
// Сюда откладывается рабочая копия, которую не удалось разобрать: иначе первое же
// сохранение перезаписало бы её значениями по умолчанию вместе с ручной работой.
export const BROKEN_STORAGE_KEY = 'ameria-view:settings:broken'

// Настройки выгружаются двумя файлами — по тому, можно ли их держать в git.
// rules.json — категории, правила, бюджеты: ничего личного, коммитится,
// из него же сборка берёт стартовые правила.
export const RULES_FIELDS = ['categories', 'rules', 'budgets']
// personal.json — номера счетов и ручные пометки. Ключ пометки — целая строка
// выписки (контрагент, оба счёта, сумма, дата), поэтому в git этот файл нельзя.
export const PERSONAL_FIELDS = ['ownAccounts', 'overrides']

const isPlainObject = (value) => value !== null && typeof value === 'object' && !Array.isArray(value)

// Проверяется ровно то, без чего приложение падает при отрисовке или разметке,
// и чего само приложение никогда не записывает: так проверка не может отвергнуть
// настоящую рабочую копию владельца.
const ARRAY_FIELDS = {
  ownAccounts: { item: (value) => typeof value === 'string', what: 'номера счетов строками' },
  categories: { item: isPlainObject, what: 'категории объектами' },
  rules: { item: isPlainObject, what: 'правила объектами' },
}
const OBJECT_FIELDS = ['overrides', 'budgets', 'opTypeCategories']

export function defaultSettings() {
  return {
    version: SETTINGS_VERSION,
    // Личные поля в стартовые настройки не берутся ни при каких условиях:
    // rules.json попадает в сборку, а личное туда попадать не должно.
    ownAccounts: [],
    categories: baseline.categories?.length ? [...baseline.categories] : [...SEED_CATEGORIES],
    rules: baseline.rules?.length ? [...baseline.rules] : [...SEED_RULES],
    overrides: {},
    budgets: { ...(baseline.budgets ?? {}) },
    opTypeCategories: { ...SEED_OPTYPE_CATEGORIES },
  }
}

export function serializeSettings(settings) {
  return JSON.stringify(settings, null, 2)
}

export function rulesFile(settings) {
  return {
    version: SETTINGS_VERSION,
    categories: settings.categories,
    rules: settings.rules,
    budgets: settings.budgets,
  }
}

export function personalFile(settings) {
  return {
    version: SETTINGS_VERSION,
    ownAccounts: settings.ownAccounts,
    overrides: settings.overrides,
  }
}

function readSettingsJson(json) {
  let parsed
  try {
    parsed = JSON.parse(json)
  } catch {
    throw new Error('Не удалось разобрать файл настроек: это не JSON')
  }
  if (!isPlainObject(parsed)) {
    throw new Error('Не удалось разобрать файл настроек: ожидался объект с полями настроек')
  }
  if (parsed.version !== SETTINGS_VERSION) {
    throw new Error(
      `Файл настроек версии ${parsed.version}, приложение понимает версию ${SETTINGS_VERSION}`,
    )
  }
  return parsed
}

function checkField(parsed, field) {
  if (!(field in parsed)) throw new Error(`В файле настроек отсутствует поле ${field}`)
  checkFieldKind(parsed, field)
}

function checkFieldKind(parsed, field) {
  const value = parsed[field]
  if (ARRAY_FIELDS[field]) {
    const { item, what } = ARRAY_FIELDS[field]
    if (!Array.isArray(value) || !value.every(item)) {
      throw new Error(`В файле настроек поле ${field} должно быть списком: ${what}`)
    }
  } else if (OBJECT_FIELDS.includes(field) && !isPlainObject(value)) {
    throw new Error(`В файле настроек поле ${field} должно быть объектом`)
  }
}

// Рабочая копия из хранилища браузера: все поля вместе.
export function parseSettings(json) {
  const parsed = readSettingsJson(json)
  for (const field of [...PERSONAL_FIELDS, ...RULES_FIELDS]) checkField(parsed, field)
  if ('opTypeCategories' in parsed) checkFieldKind(parsed, 'opTypeCategories')
  return parsed
}

// Файл, загружаемый на экране настроек: rules.json, personal.json или общий файл
// прежней версии. Какой это файл, видно по полям. Возвращаются только поля,
// которые этот файл отвечает, — чтобы наложить их на текущие настройки и не
// тронуть поля другого файла.
export function parseSettingsFile(json) {
  const parsed = readSettingsJson(json)
  const kinds = []
  const fields = {}
  if (RULES_FIELDS.some((field) => field in parsed)) {
    for (const field of RULES_FIELDS) checkField(parsed, field)
    // Пустой список категорий — это незаполненный шаблон, а не выгрузка:
    // приложение без категорий не работает, а загрузка стёрла бы текущие.
    if (parsed.categories.length === 0) {
      throw new Error('В rules.json нет ни одной категории — похоже на пустой шаблон, загружать нечего')
    }
    kinds.push('rules')
    for (const field of RULES_FIELDS) fields[field] = parsed[field]
  }
  if (PERSONAL_FIELDS.some((field) => field in parsed)) {
    for (const field of PERSONAL_FIELDS) checkField(parsed, field)
    kinds.push('personal')
    for (const field of PERSONAL_FIELDS) fields[field] = parsed[field]
  }
  if (kinds.length === 0) {
    throw new Error(
      'Файл не похож ни на rules.json, ни на personal.json: в нём нет ни правил и категорий, ни счетов и пометок',
    )
  }
  return { kinds, fields }
}

export function loadSettings() {
  const raw = localStorage.getItem(STORAGE_KEY)
  if (!raw) return defaultSettings()
  try {
    return { ...defaultSettings(), ...parseSettings(raw) }
  } catch {
    localStorage.setItem(BROKEN_STORAGE_KEY, raw)
    return defaultSettings()
  }
}

export function saveSettings(settings) {
  localStorage.setItem(STORAGE_KEY, serializeSettings(settings))
}
