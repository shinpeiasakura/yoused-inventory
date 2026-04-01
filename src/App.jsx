import { useState, useEffect, useCallback } from 'react'
import CategoryNav from './components/CategoryNav'
import InventoryView from './components/InventoryView'
import CashOtherView from './components/CashOtherView'
import { CATEGORIES, STORAGE_KEY, getInitialData } from './constants'

function genId() {
  return crypto.randomUUID()
}

function loadData() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) {
      const parsed = JSON.parse(raw)
      const initial = getInitialData()
      return {
        ...initial,
        ...parsed,
        cash: { ...initial.cash, ...(parsed.cash || {}) },
      }
    }
  } catch {
    // ignore parse errors
  }
  return getInitialData()
}

export default function App() {
  const [activeTab, setActiveTab] = useState(CATEGORIES[0])
  const [data, setData] = useState(loadData)

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data))
    } catch {
      // Storage quota exceeded
    }
  }, [data])

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
