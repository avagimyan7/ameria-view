const DB_NAME = 'ameria-view'
const DB_VERSION = 1
const STORE = 'transactions'

export function openDb() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION)
    request.onupgradeneeded = () => {
      const db = request.result
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE, { keyPath: 'key' })
      }
    }
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
}

function runTransaction(db, mode, work) {
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE, mode)
    const result = work(transaction.objectStore(STORE))
    transaction.oncomplete = () => resolve(result)
    transaction.onerror = () => reject(transaction.error)
    transaction.onabort = () => reject(transaction.error)
  })
}

export async function saveTransactions(transactions) {
  const db = await openDb()
  try {
    await runTransaction(db, 'readwrite', (store) => {
      for (const item of transactions) store.put(item)
    })
  } finally {
    db.close()
  }
}

export async function loadTransactions() {
  const db = await openDb()
  try {
    return await new Promise((resolve, reject) => {
      const request = db.transaction(STORE).objectStore(STORE).getAll()
      request.onsuccess = () => resolve(request.result ?? [])
      request.onerror = () => reject(request.error)
    })
  } finally {
    db.close()
  }
}

export async function clearTransactions() {
  const db = await openDb()
  try {
    await runTransaction(db, 'readwrite', (store) => store.clear())
  } finally {
    db.close()
  }
}
