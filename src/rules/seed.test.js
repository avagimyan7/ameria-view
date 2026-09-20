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
