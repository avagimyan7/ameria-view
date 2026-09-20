import { describe, it, expect } from 'vitest'
import { detectOwnAccounts } from './accounts.js'
import { OP } from '../domain/constants.js'

const row = (over) => ({
  date: '19-09-2026', docNo: '31', opType: OP.CARD, fromAccount: '', toAccount: '',
  counterparty: '', details: '', status: 'Հաստատված', comment: '', amount: '100.0',
  currency: 'AMD', ...over,
})

describe('detectOwnAccounts', () => {
  it('берёт оба счёта из переводов между своими счетами', () => {
    const found = detectOwnAccounts([
      row({ opType: OP.BETWEEN_OWN, fromAccount: 'A1', toAccount: 'A2' }),
    ])
    expect(found).toEqual(['A1', 'A2'])
  })

  it('добавляет счёт списания карточных операций', () => {
    const found = detectOwnAccounts([
      row({ opType: OP.CARD, fromAccount: 'CARD1', toAccount: 'SHOP' }),
    ])
    expect(found).toEqual(['CARD1'])
  })

  it('не считает своим счёт зачисления карточной операции', () => {
    const found = detectOwnAccounts([
      row({ opType: OP.CARD, fromAccount: 'CARD1', toAccount: 'SHOP' }),
    ])
    expect(found).not.toContain('SHOP')
  })

  it('игнорирует счета из прочих типов операций', () => {
    const found = detectOwnAccounts([
      row({ opType: OP.TRANSFER_TO_ACCOUNT, fromAccount: 'STRANGER', toAccount: 'OTHER' }),
    ])
    expect(found).toEqual([])
  })

  it('возвращает уникальный отсортированный список', () => {
    const found = detectOwnAccounts([
      row({ opType: OP.CARD, fromAccount: 'B' }),
      row({ opType: OP.CARD, fromAccount: 'A' }),
      row({ opType: OP.CARD, fromAccount: 'B' }),
    ])
    expect(found).toEqual(['A', 'B'])
  })
})
