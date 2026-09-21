import { describe, it, expect } from 'vitest'
import { formatAmd, formatMoney } from './format.js'

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
