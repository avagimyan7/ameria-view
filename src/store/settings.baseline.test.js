import { describe, it, expect, vi } from 'vitest'

// rules.json, в который кто-то всё же вписал личные поля. Сборка тащит этот файл
// целиком, поэтому главная защита — тест в settings.test.js на сам закоммиченный
// файл. Здесь — вторая: стартовые настройки такие поля не читают вовсе.
vi.mock('../../rules.json', () => ({
  default: {
    version: 1,
    ownAccounts: ['1570000000000001'],
    overrides: { 'ключ-строки-выписки': 'cafe' },
    categories: [{ id: 'mine', name: 'Моя категория' }],
    rules: [{ match: 'MY SHOP', category: 'mine' }],
    budgets: { mine: 300000 },
  },
}))

const { defaultSettings } = await import('./settings.js')

describe('стартовые настройки из заполненного rules.json', () => {
  it('берут правила, категории и бюджеты, но не счета и не пометки', () => {
    const settings = defaultSettings()
    expect(settings.rules).toEqual([{ match: 'MY SHOP', category: 'mine' }])
    expect(settings.categories).toEqual([{ id: 'mine', name: 'Моя категория' }])
    expect(settings.budgets).toEqual({ mine: 300000 })
    expect(settings.ownAccounts).toEqual([])
    expect(settings.overrides).toEqual({})
  })
})
