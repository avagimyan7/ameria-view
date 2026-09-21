import { describe, it, expect } from 'vitest'
import { formatAmd, formatMoney, pluralRu } from './format.js'

describe('formatMoney', () => {
  it('подписывает AMD знаком ֏, как formatAmd', () => {
    expect(formatMoney(150000, 'AMD')).toBe(formatAmd(150000))
  })

  it('подписывает другую валюту её кодом, а не знаком драма — иначе доллар выглядит как драм', () => {
    expect(formatMoney(5000, 'USD')).toBe('50 USD')
    expect(formatMoney(5000, 'USD')).not.toContain('֏')
  })

  it('без указанной валюты по умолчанию форматирует как AMD', () => {
    expect(formatMoney(150000, null)).toBe(formatAmd(150000))
    expect(formatMoney(150000, undefined)).toBe(formatAmd(150000))
  })
})

describe('pluralRu', () => {
  const OPERATION = ['операция', 'операции', 'операций']

  it('выбирает форму по числу: 1 операция, 2–4 операции, 5+ операций', () => {
    const cases = {
      1: 'операция', 2: 'операции', 5: 'операций', 11: 'операций',
      21: 'операция', 22: 'операции', 25: 'операций',
    }
    for (const [count, form] of Object.entries(cases)) {
      expect(`${count} ${pluralRu(Number(count), OPERATION)}`).toBe(`${count} ${form}`)
    }
  })

  it('11–14 — всегда «операций», в том числе в сотнях', () => {
    for (const count of [11, 12, 13, 14, 111, 112, 114]) {
      expect(pluralRu(count, OPERATION)).toBe('операций')
    }
    expect(pluralRu(101, OPERATION)).toBe('операция')
    expect(pluralRu(104, OPERATION)).toBe('операции')
    expect(pluralRu(0, OPERATION)).toBe('операций')
  })
})
