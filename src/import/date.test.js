import { describe, it, expect, afterEach } from 'vitest'
import { parseDate, monthOf, localIsoDate } from './date.js'

describe('parseDate', () => {
  it('переводит DD-MM-YYYY в ISO', () => {
    expect(parseDate('19-09-2026')).toBe('2026-09-19')
    expect(parseDate('01-01-2025')).toBe('2025-01-01')
  })

  it('бросает исключение на несуществующей дате', () => {
    expect(() => parseDate('32-01-2026')).toThrow(/дату/)
    expect(() => parseDate('29-02-2025')).toThrow(/дату/)
    expect(() => parseDate('2026-09-19')).toThrow(/дату/)
    expect(() => parseDate('')).toThrow(/дату/)
  })
})

describe('monthOf', () => {
  it('отрезает день', () => {
    expect(monthOf('2026-09-19')).toBe('2026-09')
  })
})

describe('localIsoDate', () => {
  const savedTz = process.env.TZ
  afterEach(() => {
    if (savedTz === undefined) delete process.env.TZ
    else process.env.TZ = savedTz
  })

  it('берёт местную дату, а не UTC: в 02:00 по Еревану 1 сентября — это 1 сентября', () => {
    // Ереван — UTC+4: в 02:00 по местному времени в UTC ещё 31 августа.
    process.env.TZ = 'Asia/Yerevan'
    const earlyMorning = new Date(2026, 8, 1, 2, 0)
    expect(earlyMorning.toISOString().slice(0, 10)).toBe('2026-08-31')
    expect(localIsoDate(earlyMorning)).toBe('2026-09-01')
  })

  it('дополняет месяц и день нулями', () => {
    expect(localIsoDate(new Date(2026, 0, 5, 12, 0))).toBe('2026-01-05')
  })
})
