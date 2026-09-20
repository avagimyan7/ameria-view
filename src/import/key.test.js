import { describe, it, expect } from 'vitest'
import { buildKey, assignKeys, mergeTransactions } from './key.js'

const tx = (over) => ({
  date: '2026-09-19', opType: 'Քարտային գործարք', fromAccount: 'A1', toAccount: 'SHOP',
  counterparty: 'ASK 23', details: 'Ք: ASK 23 LLC YEREVAN AM 887772', comment: '',
  status: 'Հաստատված', amount: 300000, currency: 'AMD', direction: 'expense',
  categoryId: null, ...over,
})

describe('buildKey', () => {
  it('не зависит от номера документа', () => {
    expect(buildKey({ ...tx(), docNo: '31' })).toBe(buildKey({ ...tx(), docNo: '999' }))
  })

  it('различает операции по сумме и по деталям', () => {
    expect(buildKey(tx())).not.toBe(buildKey(tx({ amount: 300001 })))
    expect(buildKey(tx())).not.toBe(buildKey(tx({ details: 'Ք: ASK 23 LLC YEREVAN AM 190677' })))
  })

  it('не путает операции из-за символа-разделителя в данных', () => {
    expect(buildKey(tx({ counterparty: 'A|B', details: 'C' })))
      .not.toBe(buildKey(tx({ counterparty: 'A', details: 'B|C' })))
  })
})

describe('assignKeys', () => {
  it('нумерует полностью одинаковые строки, не теряя вторую', () => {
    const [first, second] = assignKeys([tx(), tx()])
    expect(first.key).toMatch(/#1$/)
    expect(second.key).toMatch(/#2$/)
    expect(first.key).not.toBe(second.key)
  })

  it('воспроизводит нумерацию при повторном разборе того же файла', () => {
    const once = assignKeys([tx(), tx()]).map((t) => t.key)
    const twice = assignKeys([tx(), tx()]).map((t) => t.key)
    expect(twice).toEqual(once)
  })
})

describe('mergeTransactions', () => {
  it('повторная загрузка того же файла ничего не добавляет', () => {
    const batch = assignKeys([tx(), tx({ amount: 900 })])
    const { merged, added, duplicates } = mergeTransactions(batch, batch)
    expect(added).toBe(0)
    expect(duplicates).toBe(2)
    expect(merged).toHaveLength(2)
  })

  it('из пересекающегося периода берёт только новое', () => {
    const existing = assignKeys([tx({ date: '2026-09-01' }), tx({ date: '2026-09-10' })])
    const incoming = assignKeys([tx({ date: '2026-09-10' }), tx({ date: '2026-09-20' })])
    const { merged, added, duplicates } = mergeTransactions(existing, incoming)
    expect(added).toBe(1)
    expect(duplicates).toBe(1)
    expect(merged.map((t) => t.date)).toEqual(['2026-09-01', '2026-09-10', '2026-09-20'])
  })

  it('не затирает уже сохранённую операцию входящей копией', () => {
    const existing = assignKeys([tx({ categoryId: 'groceries' })])
    const incoming = assignKeys([tx()])
    const { merged } = mergeTransactions(existing, incoming)
    expect(merged[0].categoryId).toBe('groceries')
  })
})
