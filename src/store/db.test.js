import 'fake-indexeddb/auto'
import { describe, it, expect, beforeEach } from 'vitest'
import { saveTransactions, loadTransactions, clearTransactions } from './db.js'

const tx = (key, over = {}) => ({
  key, date: '2026-09-19', opType: 'Քարտային գործարք', fromAccount: 'MINE', toAccount: 'SHOP',
  counterparty: '', details: '', comment: '', status: 'Հաստատված', amount: 100000,
  currency: 'AMD', direction: 'expense', categoryId: null, ...over,
})

describe('хранилище транзакций', () => {
  beforeEach(async () => {
    await clearTransactions()
  })

  it('на пустой базе отдаёт пустой список', async () => {
    expect(await loadTransactions()).toEqual([])
  })

  it('сохраняет и читает обратно', async () => {
    await saveTransactions([tx('a'), tx('b')])
    const loaded = await loadTransactions()
    expect(loaded.map((t) => t.key).sort()).toEqual(['a', 'b'])
  })

  it('перезапись по ключу обновляет запись, а не плодит вторую', async () => {
    await saveTransactions([tx('a', { categoryId: null })])
    await saveTransactions([tx('a', { categoryId: 'groceries' })])
    const loaded = await loadTransactions()
    expect(loaded).toHaveLength(1)
    expect(loaded[0].categoryId).toBe('groceries')
  })

  it('очистка опустошает хранилище', async () => {
    await saveTransactions([tx('a')])
    await clearTransactions()
    expect(await loadTransactions()).toEqual([])
  })

  it('переживает сохранение пустого массива', async () => {
    await saveTransactions([])
    expect(await loadTransactions()).toEqual([])
  })
})
