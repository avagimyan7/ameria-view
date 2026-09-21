import { useState } from 'react'
import { rulePreview, ruleMatches } from '../rules/match.js'
import { suggestRuleText } from '../rules/normalize.js'
import { formatMoney, pluralRu } from './format.js'

const DIRECTION_LABELS = {
  expense: 'расходы',
  income: 'доходы',
  internal: 'переводы между своими счетами',
  unresolved: 'требующие внимания',
}

// Назначение категории операции и предложение правила «на похожие» — общее для
// списка операций и отчёта об импорте. Возвращает assign(tx, categoryId) и
// карточку-предложение (или null), которую экран кладёт к себе в разметку.
export function useRuleSuggestion({ transactions, onAssign, onCreateRule }) {
  const [pendingRule, setPendingRule] = useState(null)

  const assign = (tx, categoryId) => {
    // Пустое значение — это осознанное «снять категорию», а не отсутствие выбора.
    // Оно тоже уходит в пометки: иначе снять однажды поставленную категорию было бы нельзя,
    // а categorize() отличает «пометки нет» от «человек явно выбрал без категории»
    // по наличию ключа, а не по истинности значения.
    onAssign(tx.key, categoryId)
    if (!categoryId) {
      setPendingRule(null)
      return
    }
    const match = suggestRuleText(tx)
    if (!match) return
    // Правило сужено направлением исходной операции (спека §6.5): иначе правило,
    // предложенное на входящем личном переводе, поймает и все исходящие —
    // а вставая первым, перебьёт для них любые прежние правила.
    // sourceKey — служебное поле превью, в сохранённое правило оно не идёт.
    const rule = { match, category: categoryId, ...(tx.direction ? { direction: tx.direction } : {}) }
    setPendingRule({ rule, sourceKey: tx.key })
  }

  // rulePreview суммирует совпадения текстового правила без оглядки на валюту —
  // и правильно, у текстового паттерна нет своей валюты. Но показать эту сумму
  // одним числом с одной подписью можно только когда совпадения сами лежат
  // в одной валюте; иначе это ровно та тихая ложь, ради которой существует
  // вся задача (драмы и доллары под одним знаком ֏).
  // Превью считает ровно то правило, которое будет создано, — с тем же сужением.
  const rule = pendingRule?.rule ?? null
  const previewCandidates = pendingRule
    ? transactions.filter((t) => t.key !== pendingRule.sourceKey)
    : []
  const preview = rule ? rulePreview(previewCandidates, rule) : null
  const previewCurrencies = rule
    ? new Set(previewCandidates.filter((t) => ruleMatches(t, rule)).map((t) => t.currency))
    : new Set()
  const previewAmountText =
    previewCurrencies.size === 1
      ? ` на ${formatMoney(preview.amount, [...previewCurrencies][0])}`
      : previewCurrencies.size > 1
        ? ' в нескольких валютах — общую сумму показать нельзя'
        : ''

  // Карточка всплывает над панелью вкладок: операцию часто размечают в глубине
  // списка, и панель вверху страницы там было бы не видно.
  const sheet = rule && preview ? (
    <div className="rule-sheet" data-testid="rule-preview" role="dialog" aria-label="Создать правило">
      <p>
        Правило «{rule.match}»
        {rule.direction ? ` (только ${DIRECTION_LABELS[rule.direction] ?? rule.direction})` : ''}
        {' '}затронет ещё {preview.count}{' '}
        {pluralRu(preview.count, ['операцию', 'операции', 'операций'])}{previewAmountText}.
      </p>
      <div className="rule-sheet-actions">
        <button type="button" className="btn btn-secondary" onClick={() => setPendingRule(null)}>Не надо</button>
        <button type="button" className="btn btn-primary" onClick={() => { onCreateRule(rule); setPendingRule(null) }}>
          Создать правило
        </button>
      </div>
    </div>
  ) : null

  return { assign, sheet }
}
