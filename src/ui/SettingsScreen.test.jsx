import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, cleanup } from '@testing-library/react'
import { SettingsScreen } from './SettingsScreen.jsx'
import { defaultSettings, serializeSettings } from '../store/settings.js'

beforeEach(() => {
  cleanup()
  localStorage.clear()
  URL.createObjectURL = vi.fn(() => 'blob:fake')
  URL.revokeObjectURL = vi.fn()
})

describe('SettingsScreen', () => {
  it('показывает подтверждённые счета в замаскированном виде', () => {
    const settings = { ...defaultSettings(), ownAccounts: ['1570000000000001'] }
    render(<SettingsScreen settings={settings} onChange={() => {}} />)
    expect(screen.getByText('1570…0001')).toBeTruthy()
  })

  it('удаляет счёт из списка своих', () => {
    const onChange = vi.fn()
    const settings = { ...defaultSettings(), ownAccounts: ['A1', 'A2'] }
    render(<SettingsScreen settings={settings} onChange={onChange} />)
    fireEvent.click(screen.getByTestId('remove-account-A1'))
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ ownAccounts: ['A2'] }))
  })

  it('поднимает правило выше по списку — порядок определяет приоритет', () => {
    const onChange = vi.fn()
    const settings = {
      ...defaultSettings(),
      rules: [{ match: 'A', category: 'cafe' }, { match: 'B', category: 'groceries' }],
    }
    render(<SettingsScreen settings={settings} onChange={onChange} />)
    fireEvent.click(screen.getByTestId('rule-up-1'))
    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({
        rules: [{ match: 'B', category: 'groceries' }, { match: 'A', category: 'cafe' }],
      }),
    )
  })

  it('удаляет правило', () => {
    const onChange = vi.fn()
    const settings = { ...defaultSettings(), rules: [{ match: 'A', category: 'cafe' }] }
    render(<SettingsScreen settings={settings} onChange={onChange} />)
    fireEvent.click(screen.getByTestId('rule-remove-0'))
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ rules: [] }))
  })

  it('выгружает rules.json файлом', () => {
    render(<SettingsScreen settings={defaultSettings()} onChange={() => {}} />)
    fireEvent.click(screen.getByRole('button', { name: /выгрузить rules\.json/i }))
    expect(URL.createObjectURL).toHaveBeenCalled()
  })

  it('сообщает, если загружаемый файл настроек испорчен', async () => {
    render(<SettingsScreen settings={defaultSettings()} onChange={() => {}} />)
    const input = screen.getByTestId('settings-file')
    const file = new File(['не json'], 'rules.json', { type: 'application/json' })
    Object.defineProperty(input, 'files', { value: [file] })
    fireEvent.change(input)
    expect(await screen.findByText(/не удалось разобрать/i)).toBeTruthy()
  })

  it('не трогает текущие настройки, если загружаемый файл испорчен', async () => {
    const onChange = vi.fn()
    render(<SettingsScreen settings={defaultSettings()} onChange={onChange} />)
    const input = screen.getByTestId('settings-file')
    const file = new File(['не json'], 'rules.json', { type: 'application/json' })
    Object.defineProperty(input, 'files', { value: [file] })
    fireEvent.change(input)
    await screen.findByText(/не удалось разобрать/i)
    expect(onChange).not.toHaveBeenCalled()
  })

  it('сообщает и не трогает настройки, если версия файла не подходит', async () => {
    const onChange = vi.fn()
    render(<SettingsScreen settings={defaultSettings()} onChange={onChange} />)
    const input = screen.getByTestId('settings-file')
    const badVersion = JSON.stringify({
      version: 99,
      ownAccounts: [],
      categories: [],
      rules: [],
      overrides: {},
      budgets: {},
    })
    const file = new File([badVersion], 'rules.json', { type: 'application/json' })
    Object.defineProperty(input, 'files', { value: [file] })
    fireEvent.change(input)
    expect(await screen.findByText(/версии/i)).toBeTruthy()
    expect(onChange).not.toHaveBeenCalled()
  })

  it('загружает исправный файл и передаёт разобранные настройки наверх', async () => {
    const onChange = vi.fn()
    render(<SettingsScreen settings={defaultSettings()} onChange={onChange} />)
    const input = screen.getByTestId('settings-file')
    const incoming = {
      ...defaultSettings(),
      ownAccounts: ['9999888877776666'],
    }
    const file = new File([serializeSettings(incoming)], 'rules.json', { type: 'application/json' })
    Object.defineProperty(input, 'files', { value: [file] })
    fireEvent.change(input)
    await vi.waitFor(() => expect(onChange).toHaveBeenCalled())
    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({ ownAccounts: ['9999888877776666'] }),
    )
  })

  it('дополняет импортированный файл без opTypeCategories значениями по умолчанию, чтобы разметка по типу операции не пропадала', async () => {
    const onChange = vi.fn()
    render(<SettingsScreen settings={defaultSettings()} onChange={onChange} />)
    const input = screen.getByTestId('settings-file')
    // Старый экспорт без поля opTypeCategories — так выглядел бы файл,
    // выгруженный до появления этого поля.
    const legacy = {
      version: defaultSettings().version,
      ownAccounts: ['1111'],
      categories: defaultSettings().categories,
      rules: defaultSettings().rules,
      overrides: {},
      budgets: {},
    }
    expect('opTypeCategories' in legacy).toBe(false)
    const file = new File([JSON.stringify(legacy)], 'rules.json', { type: 'application/json' })
    Object.defineProperty(input, 'files', { value: [file] })
    fireEvent.change(input)
    await vi.waitFor(() => expect(onChange).toHaveBeenCalled())
    const applied = onChange.mock.calls[0][0]
    expect(applied.opTypeCategories).toEqual(defaultSettings().opTypeCategories)
    expect(Object.keys(applied.opTypeCategories).length).toBeGreaterThan(0)
  })

  it('сбрасывает value инпута после выбора файла — иначе повторный выбор того же файла не пришлёт change в браузере', async () => {
    const onChange = vi.fn()
    render(<SettingsScreen settings={defaultSettings()} onChange={onChange} />)
    const input = screen.getByTestId('settings-file')
    const file = new File([serializeSettings(defaultSettings())], 'rules.json', { type: 'application/json' })
    Object.defineProperty(input, 'files', { value: [file], configurable: true })
    // Реальный браузер после выбора файла заполняет value ("C:\fakepath\…").
    // jsdom не воспроизводит эту связку с files автоматически (файлы
    // подставлены вручную выше), поэтому выставляем value вручную — это и
    // есть то самое свойство, от которого зависит повторный выбор того же
    // файла, и единственное, что jsdom позволяет тут проверить.
    Object.defineProperty(input, 'value', {
      value: 'C:\\fakepath\\rules.json', writable: true, configurable: true,
    })

    fireEvent.change(input)
    // Решающая проверка: без сброса value в обработчике эта строка не
    // пройдёт.
    expect(input.value).toBe('')

    // Выбираем тот же файл ещё раз — в реальном браузере это сработает
    // только потому что value уже был сброшен.
    fireEvent.change(input)
    await vi.waitFor(() => expect(onChange).toHaveBeenCalledTimes(2))
  })
})
