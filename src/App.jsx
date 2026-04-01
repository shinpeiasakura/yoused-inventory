import { useState, useEffect, useRef, useCallback } from 'react'
import CategoryNav from './components/CategoryNav'
import InventoryView from './components/InventoryView'
import CashOtherView from './components/CashOtherView'
import { CATEGORIES, DEFAULT_COLORS } from './constants'
import {
  loadCache, saveCache, mergePhotos,
  loadFromSupabase, migrateToSupabase,
  savePhoto, deletePhoto,
  syncProduct, deleteProductFromDb,
  syncColor,
  syncCash,
  syncEquipmentItem, deleteEquipmentFromDb,
} from './lib/db'

function genId() {
  return crypto.randomUUID()
}

function getInitialData() {
  return {
    products:  [],
    colors:    DEFAULT_COLORS,
    cash:      { registerAmount: 0, history: [] },
    equipment: [],
  }
}

// Supabase 操作のエラーを握りつぶさず、コンソールに記録
function dbSync(promise) {
  promise.catch(e => console.error('[YOUSED] sync error:', e.message))
}

export default function App() {
  const [activeTab,  setActiveTab]  = useState(CATEGORIES[0])
  const [data,       setData]       = useState(() => mergePhotos(loadCache() ?? getInitialData()))
  const [syncStatus, setSyncStatus] = useState('idle') // 'idle' | 'loading' | 'ok' | 'error'

  const dataRef = useRef(data)
  dataRef.current = data

  // data が変わるたびにキャッシュ保存（写真別保管）
  useEffect(() => { saveCache(data) }, [data])

  // ページ離脱前にキャッシュを確実に保存
  useEffect(() => {
    const flush = () => saveCache(dataRef.current)
    window.addEventListener('beforeunload', flush)
    return () => window.removeEventListener('beforeunload', flush)
  }, [])

  // 起動時に Supabase からデータをロード
  useEffect(() => {
    async function init() {
      setSyncStatus('loading')
      try {
        const remote = await loadFromSupabase()

        // Supabase が空 & ローカルキャッシュにデータがある → 初回移行
        const localCache = loadCache()
        if (remote.products.length === 0 && localCache?.products?.length > 0) {
          await migrateToSupabase(localCache)
          const migrated = await loadFromSupabase()
          setData(mergePhotos(migrated))
        } else {
          setData(mergePhotos(remote))
        }

        setSyncStatus('ok')
      } catch (e) {
        console.error('[YOUSED] Supabase load failed:', e.message)
        setSyncStatus('error')
        // キャッシュデータをそのまま使う（オフライン動作）
      }
    }
    init()
  }, [])

  // ── Products ────────────────────────────────────────────────────────────────

  const addProduct = useCallback((product) => {
    const newProduct = { ...product, id: genId() }
    // 写真を localStorage に保存
    if (newProduct.photo) savePhoto(newProduct.id, newProduct.photo)
    setData(prev => ({ ...prev, products: [...prev.products, newProduct] }))
    dbSync(syncProduct(newProduct))
  }, [])

  const updateProduct = useCallback((id, updates) => {
    // 写真の更新を localStorage に反映
    if ('photo' in updates) {
      if (updates.photo) savePhoto(id, updates.photo)
      else deletePhoto(id)
    }
    setData(prev => ({
      ...prev,
      products: prev.products.map(p => (p.id === id ? { ...p, ...updates } : p)),
    }))
    // Supabase に同期（写真は含まない）
    setData(prev => {
      const product = prev.products.find(p => p.id === id)
      if (product) dbSync(syncProduct(product))
      return prev
    })
  }, [])

  const deleteProduct = useCallback((id) => {
    deletePhoto(id)
    setData(prev => ({ ...prev, products: prev.products.filter(p => p.id !== id) }))
    dbSync(deleteProductFromDb(id))
  }, [])

  // ── Colors ──────────────────────────────────────────────────────────────────

  const addColor = useCallback((color) => {
    const newColor = { ...color, id: genId() }
    setData(prev => ({ ...prev, colors: [...prev.colors, newColor] }))
    dbSync(syncColor(newColor))
  }, [])

  // ── Cash ────────────────────────────────────────────────────────────────────

  const updateCash = useCallback((cash) => {
    setData(prev => ({ ...prev, cash }))
    dbSync(syncCash(cash))
  }, [])

  // ── Equipment ───────────────────────────────────────────────────────────────

  const addEquipment = useCallback((item) => {
    const newItem = { ...item, id: genId() }
    setData(prev => ({ ...prev, equipment: [...prev.equipment, newItem] }))
    dbSync(syncEquipmentItem(newItem))
  }, [])

  const updateEquipment = useCallback((id, updates) => {
    setData(prev => ({
      ...prev,
      equipment: prev.equipment.map(e => (e.id === id ? { ...e, ...updates } : e)),
    }))
    setData(prev => {
      const item = prev.equipment.find(e => e.id === id)
      if (item) dbSync(syncEquipmentItem(item))
      return prev
    })
  }, [])

  const deleteEquipment = useCallback((id) => {
    setData(prev => ({ ...prev, equipment: prev.equipment.filter(e => e.id !== id) }))
    dbSync(deleteEquipmentFromDb(id))
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
            <div className="flex items-center gap-2">
              <span className="text-gray-500 text-[11px]">{data.products.length} items</span>
              {/* 同期ステータスインジケーター */}
              {syncStatus === 'loading' && (
                <span className="w-1.5 h-1.5 rounded-full bg-yellow-400 animate-pulse" title="同期中..." />
              )}
              {syncStatus === 'ok' && (
                <span className="w-1.5 h-1.5 rounded-full bg-green-400" title="同期済み" />
              )}
              {syncStatus === 'error' && (
                <span className="w-1.5 h-1.5 rounded-full bg-red-400" title="オフライン（ローカルデータを使用中）" />
              )}
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
