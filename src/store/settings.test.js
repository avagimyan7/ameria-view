import { describe, it, expect, beforeEach } from 'vitest'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import {
  SETTINGS_VERSION, BROKEN_STORAGE_KEY, defaultSettings, loadSettings, saveSettings,
  serializeSettings, parseSettings, parseSettingsFile, rulesFile, personalFile,
} from './settings.js'
import { SEED_OPTYPE_CATEGORIES } from '../rules/seed.js'
import { applyCategories } from '../rules/match.js'

const STORAGE_KEY = 'ameria-view:settings'
const isPlainObject = (value) => value !== null && typeof value === 'object' && !Array.isArray(value)

describe('настройки', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  // Не привязываемся к тому, что rules.json сейчас пустой: владелец закоммитит
  // свои правила и бюджеты, и тест не должен от этого краснеть.
  it('по умолчанию приезжают стартовые категории и правила и все поля нужного вида', () => {
    const settings = defaultSettings()
    expect(settings.version).toBe(SETTINGS_VERSION)
    expect(settings.categories.length).toBeGreaterThan(0)
    expect(settings.rules.length).toBeGreaterThan(0)
    expect(Array.isArray(settings.ownAccounts)).toBe(true)
    expect(isPlainObject(settings.overrides)).toBe(true)
    expect(isPlainObject(settings.budgets)).toBe(true)
  })

  it('содержит необходимые для match.js поля: opTypeCategories, rules, overrides', () => {
    const settings = defaultSettings()
    expect(settings.opTypeCategories).toEqual(SEED_OPTYPE_CATEGORIES)
    expect(Array.isArray(settings.rules)).toBe(true)
    expect(settings.rules.length).toBeGreaterThan(0)
    expect(settings.overrides).not.toBeUndefined()
    expect(typeof settings.overrides).toBe('object')
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
    localStorage.setItem(STORAGE_KEY, '{это не json')
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

  it('отвергает JSON, который не объект: null, массив, число', () => {
    for (const json of ['null', '[]', '42', '"строка"']) {
      expect(() => parseSettings(json)).toThrow(/объект/)
      expect(() => parseSettingsFile(json)).toThrow(/объект/)
    }
  })

  it('проверяет вид полей, а не только их наличие', () => {
    const valid = defaultSettings()
    const broken = [
      [{ overrides: null }, /overrides/],
      [{ overrides: [] }, /overrides/],
      [{ budgets: null }, /budgets/],
      [{ ownAccounts: 'MINE1' }, /ownAccounts/],
      [{ ownAccounts: [null] }, /ownAccounts/],
      [{ categories: {} }, /categories/],
      [{ categories: [null] }, /categories/],
      [{ rules: null }, /rules/],
      [{ rules: [null] }, /rules/],
      [{ opTypeCategories: null }, /opTypeCategories/],
    ]
    for (const [patch, message] of broken) {
      expect(() => parseSettings(JSON.stringify({ ...valid, ...patch }))).toThrow(message)
    }
  })

  it('рабочая копия с overrides: null не роняет разметку, а откатывается на значения по умолчанию', () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...defaultSettings(), overrides: null }))
    const settings = loadSettings()
    const tx = { key: 'k', details: 'ASK 23', counterparty: '', comment: '', opType: '', direction: 'expense' }
    expect(() => applyCategories([tx], settings)).not.toThrow()
  })

  it('испорченную рабочую копию откладывает, а не выбрасывает: в ней может быть ручная работа', () => {
    const raw = JSON.stringify({ ...defaultSettings(), ownAccounts: ['MINE1'], overrides: null })
    localStorage.setItem(STORAGE_KEY, raw)
    loadSettings()
    expect(localStorage.getItem(BROKEN_STORAGE_KEY)).toBe(raw)
  })
})

describe('два файла настроек: rules.json под git, personal.json — никогда', () => {
  const settings = {
    ...defaultSettings(),
    ownAccounts: ['1570000000000001'],
    overrides: { 'ключ-строки-выписки': 'cafe' },
    budgets: { groceries: 300000 },
  }

  it('rules.json содержит только версию, категории, правила и бюджеты', () => {
    const file = rulesFile(settings)
    expect(Object.keys(file).sort()).toEqual(['budgets', 'categories', 'rules', 'version'])
    expect(file).not.toHaveProperty('ownAccounts')
    expect(file).not.toHaveProperty('overrides')
  })

  it('personal.json содержит только версию, счета и ручные пометки', () => {
    const file = personalFile(settings)
    expect(Object.keys(file).sort()).toEqual(['overrides', 'ownAccounts', 'version'])
    expect(file.ownAccounts).toEqual(['1570000000000001'])
  })

  it('различает файлы по содержимому и отдаёт только поля своего файла', () => {
    const rules = parseSettingsFile(serializeSettings(rulesFile(settings)))
    expect(rules.kinds).toEqual(['rules'])
    expect(Object.keys(rules.fields).sort()).toEqual(['budgets', 'categories', 'rules'])

    const personal = parseSettingsFile(serializeSettings(personalFile(settings)))
    expect(personal.kinds).toEqual(['personal'])
    expect(Object.keys(personal.fields).sort()).toEqual(['overrides', 'ownAccounts'])
  })

  it('принимает общий файл прежней версии как оба сразу', () => {
    const legacy = parseSettingsFile(serializeSettings(settings))
    expect(legacy.kinds).toEqual(['rules', 'personal'])
    expect(legacy.fields.ownAccounts).toEqual(['1570000000000001'])
  })

  it('отвергает файл, в котором нет ни правил, ни личных полей', () => {
    expect(() => parseSettingsFile(JSON.stringify({ version: SETTINGS_VERSION }))).toThrow(/rules\.json.*personal\.json/)
  })

  it('отвергает неполный файл и файл с полями неверного вида', () => {
    expect(() => parseSettingsFile(JSON.stringify({ version: SETTINGS_VERSION, ownAccounts: [] })))
      .toThrow(/overrides/)
    expect(() => parseSettingsFile(JSON.stringify({ ...personalFile(settings), overrides: null })))
      .toThrow(/overrides/)
    expect(() => parseSettingsFile(JSON.stringify({ ...rulesFile(settings), rules: [null] })))
      .toThrow(/rules/)
  })

  it('отвергает rules.json без единой категории — это пустой шаблон, он стёр бы категории', () => {
    expect(() => parseSettingsFile(JSON.stringify({ ...rulesFile(settings), categories: [] })))
      .toThrow(/категори/)
  })

  it('rules.json в репозитории не содержит личных полей — он попадает в сборку', () => {
    const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..')
    const committed = JSON.parse(readFileSync(path.join(root, 'rules.json'), 'utf8'))
    expect(committed).not.toHaveProperty('ownAccounts')
    expect(committed).not.toHaveProperty('overrides')
  })
})
