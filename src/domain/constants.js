// Заголовки колонок выгрузки myAmeria History.
// Сравниваются после trim(): в реальном файле 'Ելքագրվող հաշիվ ' идёт с хвостовым пробелом.
export const HEADERS = {
  date: 'Ամսաթիվ',
  docNo: 'Փաստ N',
  opType: 'ԳՏ',
  fromAccount: 'Ելքագրվող հաշիվ',
  toAccount: 'Շահառուի հաշիվ',
  counterparty: 'Վճարող/Շահառու',
  details: 'Մանրամասներ',
  status: 'Կարգավիճակ',
  comment: 'Մեկնաբանություն',
  amount: 'Գումար',
  currency: 'Արժույթ',
}

// Типы операций, которые банк проставляет сам в колонке ԳՏ.
export const OP = {
  CARD: 'Քարտային գործարք',
  TRANSFER_TO_CARD: 'Փոխանցում քարտին',
  TRANSFER_FEE: 'Փոխանցման միջնորդավճար',
  BETWEEN_OWN: 'Իմ հաշիվների միջև',
  TRANSFER_TO_ACCOUNT: 'Հաշվին փոխանցում',
  INTEREST_REPAY: 'Տոկոսի մարում',
  LOAN_REPAY: 'Վարկի մարում',
  DEPOSIT_TOPUP: 'Ավանդի համալրում',
  LOAN_ISSUE: 'Վարկի տրամադրում',
}

export const STATUS_APPROVED = 'Հաստատված'
