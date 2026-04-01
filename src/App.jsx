import { useState, useEffect, useRef, useCallback } from 'react'
import CategoryNav from './components/CategoryNav'
import InventoryView from './components/InventoryView'
import CashOtherView from './components/CashOtherView'
import { CATEGORIES, STORAGE_KEY, DEFAULT_COLORS } from './constants'

function genId() {
  return crypto.randomUUID()
}

// localStorage から安全に読み込む
function loadData() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    const p = JSON.parse(raw)
    if (!p || typeof p !== 'object') return null
    return {
      products:  Array.isArray(p.products)  ? p.products  : [],
      colors:    Array.isArray(p.colors) && p.colors.length > 0
                   ? p.colors
                   : DEFAULT_COLORS,
      cash: {
        registerAmount: typeof p.cash?.registerAmount === 'number'
                          ? p.cash.registerAmount
                          : 0,
        history: Array.isArray(p.cash?.history) ? p.cash.history : [],
      },
      equipment: Array.isArray(p.equipment) ? p.equipment : [],
    }
  } catch (e) {
    console.error('[YOUSED] load failed:', e)
    return null
  }
}

function getInitialData() {
  return {
    products:  [],
    colors:    DEFAULT_COLORS,
    cash:      { registerAmount: 0, history: [] },
    equipment: [],
  }
}

// localStorage に保存。容量超過時は写真を除いて再試行
function saveData(data) {
  const attempt = (payload) => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(payload))
  }
  try {
    attempt(data)
  } catch {
    // 写真を除いて再試行
    try {
      attempt({
        ...data,
        products: data.products.map(({ photo, ...rest }) => rest),
      })
      console.warn('[YOUSED] 写真を除いて保存しました（容量不足）')
    } catch (e2) {
      console.error('[YOUSED] 保存に失敗しました:', e2)
    }
  }
}

export default function App() {
  const [activeTab, setActiveTab] = useState(CATEGORIES[0])
  const [data, setData] = useState(() => loadData() ?? getInitialData())

  // 常に最新のデータを参照できる ref（beforeunload で使用）
  const dataRef = useRef(data)
  dataRef.current = data

  // data が変わるたびに保存
  useEffect(() => {
    saveData(data)
  }, [data])

  // ページを閉じる/リロード直前にも保存
  useEffect(() => {
    const flush = () => saveData(dataRef.current)
    window.addEventListener('beforeunload', flush)
    return () => window.removeEventListener('beforeunload', flush)
  }, [])

  const addProduct = useCallback((product) => {
    setData(prev => ({
      ...prev,
      products: [...prev.products, { ...product, id: genId() }],
    }))
  }, [])

  const updateProduct = useCallback((id, updates) => {
    setData(prev => ({
      ...prev,
      products: prev.products.map(p => (p.id === id ? { ...p, ...updates } : p)),
    }))
  }, [])

  const deleteProduct = useCallback((id) => {
    setData(prev => ({
      ...prev,
      products: prev.products.filter(p => p.id !== id),
    }))
  }, [])

  const addColor = useCallback((color) => {
    setData(prev => ({
      ...prev,
      colors: [...prev.colors, { ...color, id: genId() }],
    }))
  }, [])

  const updateCash = useCallback((cash) => {
    setData(prev => ({ ...prev, cash }))
  }, [])

  const addEquipment = useCallback((item) => {
    setData(prev => ({
      ...prev,
      equipment: [...prev.equipment, { ...item, id: genId() }],
    }))
  }, [])

  const updateEquipment = useCallback((id, updates) => {
    setData(prev => ({
      ...prev,
      equipment: prev.equipment.map(e => (e.id === id ? { ...e, ...updates } : e)),
    }))
  }, [])

  const deleteEquipment = useCallback((id) => {
    setData(prev => ({
      ...prev,
      equipment: prev.equipment.filter(e => e.id !== id),
    }))
  }, [])

  const categoryProducts = data.products.filter(p => p.category === activeTab)

  return (
    <div className="min-h-dvh bg-[#F7F5F1]">
      <div className="sticky top-0 z-40">
        <header className="bg-[#1A1A1A] safe-top">
          <div className="px-4 pt-3 pb-2 flex items-end justify-between">
            <div>
              <h1 className="text-white text-lg font-bold tracking-[0.2em] leading-none m-0">YOUSED</h1>
              <p className="text-[#C4956A] text-[10px] tracking-[0.3em] mt-0.5">INVENTORY MANAGER</p>
            </div>
            <div className="text-right">
              <span className="text-gray-500 text-[11px]">{data.products.length} items</span>
            </div>
          </div>
        </header>
        <CategoryNav active={activeTab} onChange={setActiveTab} />
      </div>

      <main className="pb-safe">
        {activeTab === 'Cash&Others' ? (
          <CashOtherView
            cash={data.cash}
            equipment={data.equipment}
            onUpdateCash={updateCash}
            onAddEquipment={addEquipment}
            onUpdateEquipment={updateEquipment}
            onDeleteEquipment={deleteEquipment}
          />
        ) : (
          <InventoryView
            category={activeTab}
            products={categoryProducts}
            colors={data.colors}
            onAddProduct={addProduct}
            onUpdateProduct={updateProduct}
            onDeleteProduct={deleteProduct}
            onAddColor={addColor}
          />
        )}
      </main>
    </div>
  )
}
