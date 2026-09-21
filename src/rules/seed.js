import { OP } from '../domain/constants.js'

export const SEED_CATEGORIES = [
  { id: 'groceries', name: 'Продукты', color: '#22A33A' },
  { id: 'cafe', name: 'Кафе и рестораны', color: '#E8A13A' },
  { id: 'pharmacy', name: 'Аптека', color: '#10B981' },
  { id: 'transport', name: 'Транспорт', color: '#2196F3' },
  { id: 'subscriptions', name: 'Подписки', color: '#6C4BF0' },
  { id: 'utilities', name: 'Коммуналка', color: '#8A8F98' },
  { id: 'telecom', name: 'Связь', color: '#06B6D4' },
  { id: 'shopping', name: 'Покупки', color: '#D81B60' },
  { id: 'fees', name: 'Комиссии банка', color: '#FF9800' },
  { id: 'loan_principal', name: 'Кредит: тело', color: '#C9184A' },
  { id: 'loan_interest', name: 'Кредит: проценты', color: '#E11D62' },
  { id: 'deposit', name: 'Депозит', color: '#14B8A6' },
  { id: 'loan_in', name: 'Кредит получен', color: '#8B5CF6' },
  { id: 'salary', name: 'Зарплата', color: '#34D399' },
  { id: 'other', name: 'Прочее', color: '#868E96' },
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
