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
