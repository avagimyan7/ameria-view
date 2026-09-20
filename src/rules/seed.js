import { OP } from '../domain/constants.js'

export const SEED_CATEGORIES = [
  { id: 'groceries', name: 'Продукты', color: '#2f9e44' },
  { id: 'cafe', name: 'Кафе и рестораны', color: '#e8590c' },
  { id: 'pharmacy', name: 'Аптека', color: '#0ca678' },
  { id: 'transport', name: 'Транспорт', color: '#1971c2' },
  { id: 'subscriptions', name: 'Подписки', color: '#7048e8' },
  { id: 'utilities', name: 'Коммуналка', color: '#495057' },
  { id: 'telecom', name: 'Связь', color: '#1098ad' },
  { id: 'shopping', name: 'Покупки', color: '#c2255c' },
  { id: 'fees', name: 'Комиссии банка', color: '#f08c00' },
  { id: 'loan_principal', name: 'Кредит: тело', color: '#a61e4d' },
  { id: 'loan_interest', name: 'Кредит: проценты', color: '#d6336c' },
  { id: 'deposit', name: 'Депозит', color: '#087f5b' },
  { id: 'loan_in', name: 'Кредит получен', color: '#5f3dc4' },
  { id: 'salary', name: 'Зарплата', color: '#2b8a3e' },
  { id: 'other', name: 'Прочее', color: '#868e96' },
]

// Порядок важен: срабатывает первое подходящее правило.
export const SEED_RULES = [
  { match: 'ASK 23', category: 'groceries' },
  { match: 'ԱՍԿ 23', category: 'groceries' },
  { match: 'OPTIM MARKET', category: 'groceries' },
  { match: 'YEREVAN CITY', category: 'groceries' },
  { match: 'EREBUNU SHUKA', category: 'groceries' },

  { match: 'AKG', category: 'pharmacy' },
  { match: 'ROSTOFARM', category: 'pharmacy' },
  { match: 'ԴԵՂԱՏ', category: 'pharmacy' },

  { match: 'YANDEX.PLUS', category: 'subscriptions' },
  { match: 'APPLE.COM', category: 'subscriptions' },
  { match: 'FIGMA', category: 'subscriptions' },
  { match: 'GOOGLE ONE', category: 'subscriptions' },
  { match: 'CLOUDFLARE', category: 'subscriptions' },
  { match: 'PROFIT SOFT', category: 'subscriptions' },

  { match: 'TELCELL', category: 'transport' },
  { match: 'YANDEX. GO', category: 'transport' },
  { match: 'YANDEX.GO', category: 'transport' },
  { match: 'PARKING', category: 'transport' },

  { match: 'UCOM', category: 'telecom' },
  { match: 'TEAM TELECOM', category: 'telecom' },
  { match: 'IDRAM UTILITY', category: 'utilities' },

  { match: 'CORN DOG', category: 'cafe' },
  { match: 'SORISO', category: 'cafe' },

  { match: 'WILDBERRIES', category: 'shopping' },
  { match: 'UNO SHOES', category: 'shopping' },

  { match: 'ԱՇԽԱՏԱՎԱՐՁ', category: 'salary', direction: 'income' },

  { match: 'COMMISSION', category: 'fees' },
  { match: 'ԳԱՆՁՈՒՄ', category: 'fees' },
  { match: 'ՄԻՋՆ.', category: 'fees' },
]

// Разметка, которую банк проставляет сам — точная и бесплатная.
export const SEED_OPTYPE_CATEGORIES = {
  [OP.TRANSFER_FEE]: 'fees',
  [OP.LOAN_REPAY]: 'loan_principal',
  [OP.INTEREST_REPAY]: 'loan_interest',
  [OP.DEPOSIT_TOPUP]: 'deposit',
  [OP.LOAN_ISSUE]: 'loan_in',
}
