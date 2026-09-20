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
