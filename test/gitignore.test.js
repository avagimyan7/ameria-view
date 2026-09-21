import { describe, it, expect } from 'vitest'
import { execFileSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..')

// Спрашиваем сам git, а не разбираем .gitignore вручную. --no-index: проверяются
// правила игнорирования, а не то, лежит ли файл уже в индексе.
function ignoredByGit(file) {
  try {
    execFileSync('git', ['check-ignore', '-q', '--no-index', file], { cwd: root })
    return true
  } catch (error) {
    if (error.status === 1) return false
    throw error
  }
}

describe('личный файл настроек не попадает в git', () => {
  it('personal.json игнорируется — в нём счета и строки выписки', () => {
    expect(ignoredByGit('personal.json')).toBe(true)
  })

  it('копия, которую браузер сохранил рядом под новым именем, тоже игнорируется', () => {
    expect(ignoredByGit('personal (1).json')).toBe(true)
  })

  it('rules.json при этом не игнорируется — его держат в репозитории', () => {
    expect(ignoredByGit('rules.json')).toBe(false)
  })
})
