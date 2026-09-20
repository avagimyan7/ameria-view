// Деньги хранятся целыми числами в лумах: 1 AMD = 100 лумов.
// parseFloat к суммам не применяется нигде — он даёт расхождения в итогах.
export function parseAmount(raw) {
  const text = String(raw ?? '').trim().replace(/\s/g, '').replace(',', '.')
  const match = /^(-?)(\d+)(?:\.(\d{1,2}))?$/.exec(text)
  if (!match) throw new Error(`Не удалось разобрать сумму: ${JSON.stringify(raw)}`)
  const [, sign, whole, fraction = ''] = match
  const luma = Number(whole) * 100 + Number(`${fraction}00`.slice(0, 2))
  return sign === '-' ? -luma : luma
}

export function formatAmount(luma) {
  const sign = luma < 0 ? '-' : ''
  const abs = Math.abs(luma)
  const whole = String(Math.floor(abs / 100)).replace(/\B(?=(\d{3})+(?!\d))/g, ' ')
  const fraction = abs % 100
  return fraction === 0
    ? `${sign}${whole}`
    : `${sign}${whole},${String(fraction).padStart(2, '0')}`
}
