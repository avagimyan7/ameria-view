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
