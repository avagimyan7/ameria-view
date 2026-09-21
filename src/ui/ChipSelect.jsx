// Выпадающий список в виде чипа по ширине выбранной подписи. Обычный <select>
// всегда шириной с самый длинный вариант: «Все категории» растягивались под
// «Пополнение кошельков». Поэтому видна подпись, а поверх неё лежит прозрачный
// настоящий <select> — на iPhone он по-прежнему открывает системный барабан.
export function ChipSelect({
  value, onChange, options, ariaLabel, active = false, dot = null, dashed = false,
  className = '', testId,
}) {
  const current = options.find((option) => option.value === value) ?? options[0]
  return (
    <span
      className={`chip chip-select${active ? ' is-active' : ''}${dashed ? ' is-dashed' : ''}${dot ? ' has-dot' : ''} ${className}`}
    >
      {dot && <span className="dot" style={{ background: dot }} />}
      <span className="chip-label">{current?.label}</span>
      <svg width="13" height="13" viewBox="0 0 13 13" fill="none" stroke="currentColor" strokeWidth="1.9"
        strokeLinecap="round" aria-hidden="true" className="chip-chevron">
        <path d="M3 4.5l3.5 3.5L10 4.5" />
      </svg>
      <select
        aria-label={ariaLabel}
        data-testid={testId}
        value={value}
        onChange={(event) => onChange(event.target.value)}
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>{option.label}</option>
        ))}
      </select>
    </span>
  )
}
