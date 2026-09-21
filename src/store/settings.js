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
