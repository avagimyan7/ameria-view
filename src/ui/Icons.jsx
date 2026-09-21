// Линейные иконки из макета. Все — декоративные: подпись всегда рядом текстом,
// поэтому aria-hidden и никаких title.
function Svg({ size, viewBox, strokeWidth = 1.8, children, ...rest }) {
  return (
    <svg
      width={size} height={size} viewBox={viewBox ?? `0 0 ${size} ${size}`} fill="none"
      stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round"
      aria-hidden="true" focusable="false" {...rest}
    >
      {children}
    </svg>
  )
}

// ---------- вкладки ----------

export const TabIcons = {
  overview: () => <Svg size={22}><path d="M4 14v4M11 8v10M18 4v14" /></Svg>,
  categories: () => (
    <Svg size={22} strokeWidth={1.7}><path d="M4 4h6v6H4zM12 4h6v6h-6zM4 12h6v6H4zM12 12h6v6h-6z" /></Svg>
  ),
  transactions: () => <Svg size={22}><path d="M4 6h14M4 11h14M4 16h9" /></Svg>,
  import: () => <Svg size={22}><path d="M11 3v10M7 9l4 4 4-4M4 18h14" /></Svg>,
  settings: () => (
    <Svg size={22}>
      <path d="M3 7h9M16 7h3M3 15h3M10 15h9" /><circle cx="14" cy="7" r="2.2" /><circle cx="8" cy="15" r="2.2" />
    </Svg>
  ),
}

// ---------- интерфейс ----------

export const ChevronLeft = () => <Svg size={18}><path d="M11 4l-5 5 5 5" /></Svg>
export const ChevronRight = () => <Svg size={18}><path d="M7 4l5 5-5 5" /></Svg>
export const ArrowUp = ({ size = 14 }) => (
  <Svg size={size} viewBox="0 0 14 14" strokeWidth={2}><path d="M7 11V3M3.5 6.5L7 3l3.5 3.5" /></Svg>
)
export const ArrowDown = ({ size = 14 }) => (
  <Svg size={size} viewBox="0 0 14 14" strokeWidth={2}><path d="M7 3v8M3.5 7.5L7 11l3.5-3.5" /></Svg>
)
export const Info = () => (
  <Svg size={16} strokeWidth={1.6}><circle cx="8" cy="8" r="6.2" /><path d="M8 7.2v4M8 4.9v.1" /></Svg>
)
export const Search = () => (
  <Svg size={17}><circle cx="7.5" cy="7.5" r="4.8" /><path d="M11.2 11.2L15 15" /></Svg>
)
export const Filter = () => <Svg size={18}><path d="M2.5 4.5h13M4.5 9h9M7.5 13.5h3" /></Svg>
export const Plus = () => <Svg size={20} strokeWidth={2.2}><path d="M10 4v12M4 10h12" /></Svg>
export const Check = ({ size = 17 }) => (
  <Svg size={size} viewBox="0 0 17 17" strokeWidth={2}><path d="M3.5 9l3.5 3.5L14 5.5" /></Svg>
)
export const MoveUp = () => <Svg size={18} strokeWidth={1.9}><path d="M9 14V4M4.5 8.5L9 4l4.5 4.5" /></Svg>
export const Trash = () => (
  <Svg size={18} strokeWidth={1.7}><path d="M3.5 5.5h11M7 5.5V3.5h4v2M5.5 5.5l.8 9h5.4l.8-9" /></Svg>
)
export const Download = ({ size = 30 }) => (
  <Svg size={size} viewBox="0 0 30 30"><path d="M15 4v14M9.5 12.5L15 18l5.5-5.5M5 22h20" /></Svg>
)
export const EmptyChart = () => <Svg size={38}><path d="M8 26v4M19 14v16M30 8v22" /></Svg>

// ---------- иконки операций ----------

const glyphs = {
  income: <path d="M9 14V4M5 8l4-4 4 4" />,
  transfer: <path d="M4 7h11M11 3.5L14.5 7 11 10.5M15 12H4M8 8.5L4.5 12 8 15.5" />,
  card: <><rect x="2.5" y="4.5" width="13" height="9" rx="2" /><path d="M2.5 8h13" /></>,
  car: (
    <>
      <path d="M3.5 12V7.5l1.5-3h9l1.5 3V12M3.5 12h12M5.5 12v2M13.5 12v2" />
      <circle cx="6.5" cy="9.5" r=".8" /><circle cx="12.5" cy="9.5" r=".8" />
    </>
  ),
  bag: <path d="M4 6.5h11l-1 8.5H5zM7 6.5V5a2.5 2.5 0 015 0v1.5" />,
  cup: <path d="M4 6.5h9v4a4 4 0 01-4 4h-1a4 4 0 01-4-4zM13 8h1.5a2 2 0 010 4H13M7 3v1.5M10 3v1.5" />,
  cross: <path d="M7.5 3.5h4v4h4v4h-4v4h-4v-4h-4v-4h4z" />,
  repeat: <path d="M4 8V7a2.5 2.5 0 012.5-2.5H14M11.5 2l2.5 2.5L11.5 7M15 11v1a2.5 2.5 0 01-2.5 2.5H5M7.5 17L5 14.5 7.5 12" />,
  bolt: <path d="M10.5 2.5L4.5 10.5h4.5l-1 6 6-8h-4.5z" />,
  signal: <path d="M4 15v-2M7.5 15v-5M11 15V7M14.5 15V4" />,
  cash: <><rect x="2.5" y="5" width="14" height="9" rx="1.5" /><circle cx="9.5" cy="9.5" r="2" /></>,
  wallet: <><path d="M3 6.5A1.5 1.5 0 014.5 5H14v2.5M3 6.5v7A1.5 1.5 0 004.5 15h11V7.5H4.5A1.5 1.5 0 013 6.5z" /><circle cx="12.5" cy="11.2" r=".8" /></>,
  safe: <><rect x="3" y="3.5" width="13" height="12" rx="2" /><circle cx="9.5" cy="9.5" r="2.5" /><path d="M9.5 7v.1" /></>,
  wrench: <path d="M12 3.5a3.5 3.5 0 00-3.3 4.6L3.5 13.3 5.7 15.5l5.2-5.2A3.5 3.5 0 0015.5 7l-2 2-2-.5-.5-2 2-2a3.5 3.5 0 00-1-.5z" />,
  handshake: <path d="M2.5 8l3-3 3 1.5L11 5l5.5 3M5 11l2.5 2.5a1 1 0 001.5 0l4-4M2.5 8L5 11M16.5 8L13 11.5" />,
  dot: <circle cx="9.5" cy="9.5" r="2.5" />,
}

// Иконка по смыслу категории; для незнакомой категории — нейтральная точка.
const CATEGORY_GLYPH = {
  groceries: 'bag', shopping: 'bag', cafe: 'cup', pharmacy: 'cross', transport: 'car',
  subscriptions: 'repeat', utilities: 'bolt', telecom: 'signal', loan_principal: 'card',
  loan_interest: 'card', loan_in: 'card', deposit: 'safe', salary: 'income', cash: 'cash',
  transfers: 'transfer', debts: 'handshake', services: 'wrench', wallets: 'wallet',
}

export function glyphFor(tx) {
  if (tx.categoryId === 'fees') return '%'
  if (tx.categoryId && CATEGORY_GLYPH[tx.categoryId]) return CATEGORY_GLYPH[tx.categoryId]
  if (tx.direction === 'income') return 'income'
  if (tx.direction === 'internal') return 'transfer'
  return 'dot'
}

export function TxGlyph({ name }) {
  if (name === '%') return <span className="tx-glyph-text" aria-hidden="true">%</span>
  return <Svg size={19}>{glyphs[name] ?? glyphs.dot}</Svg>
}
