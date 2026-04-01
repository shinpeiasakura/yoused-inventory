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

export const ALL_TABS = [...CATEGORIES, 'Cash&Others']

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
