export const CATEGORIES = [
  'Leather',
  'Harris',
  'Duck',
  'Oiled',
  'Pants',
  'Over-dye',
  'JKT',
  'Sweater',
  'Shirts',
  'Cap',
  'Others',
]

export const TODAY_SALES_TAB = '本日の販売'
export const ALL_TABS = [...CATEGORIES, TODAY_SALES_TAB, 'Cash&Others']

export const DEFAULT_COLORS = [
  { id: 'black',    name: 'Black',    hex: '#1A1A1A' },
  { id: 'white',    name: 'White',    hex: '#EDEDEA' },
  { id: 'navy',     name: 'Navy',     hex: '#1B2A4A' },
  { id: 'indigo',   name: 'Indigo',   hex: '#2E3A7A' },
  { id: 'olive',    name: 'Olive',    hex: '#6B7A3E' },
  { id: 'khaki',    name: 'Khaki',    hex: '#A89F6E' },
  { id: 'brown',    name: 'Brown',    hex: '#7B4F2E' },
  { id: 'camel',    name: 'Camel',    hex: '#C4956A' },
  { id: 'natural',  name: 'Natural',  hex: '#D4C4A8' },
  { id: 'burgundy', name: 'Burgundy', hex: '#7C2D34' },
  { id: 'grey',     name: 'Grey',     hex: '#8E8E93' },
  { id: 'green',    name: 'Green',    hex: '#4A7C59' },
  { id: 'red',      name: 'Red',      hex: '#C0392B' },
]

export function getInitialData() {
  return {
    products: [],
    colors: DEFAULT_COLORS,
    cash: {
      registerAmount: 0,
      history: [],
    },
    equipment: [],
  }
}

export const STORAGE_KEY = 'yoused_inventory_v1'

export const ALERT_LEVELS = [
  { value: 'ok',   label: '在庫あり', bg: '#EEF5EE', text: '#2D5A2D', dot: '#5B8C5A' },
  { value: 'want', label: '追加希望', bg: '#FDF3EA', text: '#6B3A1F', dot: '#C17F55' },
  { value: 'out',  label: '在庫切れ', bg: '#FDE8E8', text: '#7A1F1F', dot: '#C0392B' },
]

export const ALERT_CONFIG = Object.fromEntries(ALERT_LEVELS.map(a => [a.value, a]))

export function calcAlert(storeStock, stock501) {
  const total = (Number(storeStock) || 0) + (Number(stock501) || 0)
  if (total === 0) return 'out'
  if (total <= 2)  return 'want'
  return 'ok'
}
