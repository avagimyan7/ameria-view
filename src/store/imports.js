// Журнал последних импортов — для экрана «Импорт» и подписи «последний импорт».
// Лежит отдельно от настроек: это не ручная работа, а история этого устройства,
// в rules.json / personal.json она не выгружается.
export const IMPORTS_KEY = 'ameria-view:imports'
export const MAX_IMPORTS = 10

const isEntry = (value) =>
  value !== null && typeof value === 'object' && typeof value.name === 'string' &&
  typeof value.importedAt === 'string' && Number.isFinite(value.added)

export function loadImports() {
  try {
    const parsed = JSON.parse(localStorage.getItem(IMPORTS_KEY) ?? '[]')
    return Array.isArray(parsed) ? parsed.filter(isEntry) : []
  } catch {
    return []
  }
}

export function recordImport(entry) {
  const list = [entry, ...loadImports()].slice(0, MAX_IMPORTS)
  try {
    localStorage.setItem(IMPORTS_KEY, JSON.stringify(list))
  } catch {
    // Хранилище переполнено или закрыто — журнал необязателен, импорт важнее.
  }
  return list
}
