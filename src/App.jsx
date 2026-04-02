import { useState, useEffect, useRef, useCallback } from 'react'
import CategoryNav from './components/CategoryNav'
import InventoryView from './components/InventoryView'
import CashOtherView from './components/CashOtherView'
import { CATEGORIES, DEFAULT_COLORS } from './constants'
import {
  loadCache, saveCache, mergeTempPhotos,
  loadFromSupabase, migrateToSupabase,
  uploadPhoto, deletePhotoFromStorage,
  saveTempPhoto, deleteTempPhoto,
  syncProduct, deleteProductFromDb,
  syncColor,
  syncCash,
  syncEquipmentItem, deleteEquipmentFromDb,
  parseProductRow,
} from './lib/db'
import { subscribeToRealtime } from './lib/realtime'

function genId() { return crypto.randomUUID() }

function getInitialData() {
  return {
    products:  [],
    colors:    DEFAULT_COLORS,
    cash:      { registerAmount: 0, history: [] },
    equipment: [],
  }
}

function dbSync(promise) {
  promise.catch(e => console.error('[YOUSED] sync error:', e.message))
}

export default function App() {
  const [activeTab,      setActiveTab]      = useState(CATEGORIES[0])
  const [data,           setData]           = useState(() => mergeTempPhotos(loadCache() ?? getInitialData()))
  const [syncStatus,     setSyncStatus]     = useState('idle')
  const [realtimeStatus, setRealtimeStatus] = useState('connecting')

  const dataRef  = useRef(data)
  dataRef.current = data

  const debounceTimers = useRef({})
  const debouncedSync = useCallback((id) => {
    clearTimeout(debounceTimers.current[id])
    debounceTimers.current[id] = setTimeout(() => {
      const product = dataRef.current.products.find(p => p.id === id)
      if (product) dbSync(syncProduct(product))
    }, 800)
  }, [])

  useEffect(() => { saveCache(data) }, [data])

  useEffect(() => {
    const flush = () => saveCache(dataRef.current)
    window.addEventListener('beforeunload', flush)
    return () => window.removeEventListener('beforeunload', flush)
  }, [])

  // ── Realtime 購読 ────────────────────────────────────────────────────────────
  useEffect(() => {
    return subscribeToRealtime((table, { eventType, new: newRow, old: oldRow }) => {
      setData(prev => {

        if (table === 'products') {
          const incoming = parseProductRow(newRow ?? {})

          if (eventType === 'INSERT') {
            const exists = prev.products.find(p => p.id === incoming.id)
            if (exists) {
              return {
                ...prev,
                products: prev.products.map(p =>
                  p.id === incoming.id ? { ...incoming, photo: p.photo } : p
                ),
              }
            }
            return { ...prev, products: [...prev.products, incoming] }
          }

          if (eventType === 'UPDATE') {
            return {
              ...prev,
              products: prev.products.map(p =>
                p.id === incoming.id ? { ...incoming, photo: p.photo } : p
              ),
            }
          }

          if (eventType === 'DELETE') {
            return {
              ...prev,
              products: prev.products.filter(p => p.id !== (oldRow?.id ?? '')),
            }
          }
        }

        if (table === 'colors') {
          if (eventType === 'INSERT') {
            if (prev.colors.find(c => c.id === newRow.id)) return prev
            return { ...prev, colors: [...prev.colors, newRow] }
          }
          if (eventType === 'UPDATE') {
            return { ...prev, colors: prev.colors.map(c => c.id === newRow.id ? newRow : c) }
          }
          if (eventType === 'DELETE') {
            return { ...prev, colors: prev.colors.filter(c => c.id !== oldRow?.id) }
          }
        }

        if (table === 'cash_data' && eventType !== 'DELETE') {
          return {
            ...prev,
            cash: {
              registerAmount: newRow.register_amount ?? 0,
              history:        newRow.history         ?? [],
            },
          }
        }

        if (table === 'equipment') {
          if (eventType === 'INSERT') {
            if (prev.equipment.find(e => e.id === newRow.id)) return prev
            return { ...prev, equipment: [...prev.equipment, newRow] }
          }
          if (eventType === 'UPDATE') {
            return {
              ...prev,
              equipment: prev.equipment.map(e => e.id === newRow.id ? newRow : e),
            }
          }
          if (eventType === 'DELETE') {
            return {
              ...prev,
              equipment: prev.equipment.filter(e => e.id !== oldRow?.id),
            }
          }
        }

        return prev
      })
    }, setRealtimeStatus)
  }, [])

  // 起動時に Supabase からロード
  useEffect(() => {
    async function init() {
      setSyncStatus('loading')
      try {
        const remote = await loadFromSupabase()
        const localCache = loadCache()
        if (remote.products.length === 0 && localCache?.products?.length > 0) {
          await migrateToSupabase(localCache)
          const migrated = await loadFromSupabase()
          setData(mergeTempPhotos(migrated))
        } else {
          setData(mergeTempPhotos(remote))
        }
        setSyncStatus('ok')
      } catch (e) {
        console.error('[YOUSED] Supabase load failed:', e.message)
        setSyncStatus('error')
      }
    }
    init()
  }, [])

  // ── Products ────────────────────────────────────────────────────────────────

  const addProduct = useCallback((product) => {
    const id = genId()
    const newProduct = { ...product, id, photoUrl: null }

    if (newProduct.photo) {
      saveTempPhoto(id, newProduct.photo)
    }

    setData(prev => ({ ...prev, products: [...prev.products, newProduct] }))

    if (newProduct.photo) {
      uploadPhoto(id, newProduct.photo)
        .then(photoUrl => {
          deleteTempPhoto(id)
          setData(prev => {
            const products = prev.products.map(p =>
              p.id === id ? { ...p, photoUrl, photo: null } : p
            )
            const updated = products.find(p => p.id === id)
            if (updated) dbSync(syncProduct(updated))
            return { ...prev, products }
          })
        })
        .catch(e => {
          console.error('[YOUSED] photo upload failed:', e.message)
          dbSync(syncProduct(newProduct))
        })
    } else {
      dbSync(syncProduct(newProduct))
    }
  }, [])

  const updateProduct = useCallback((id, updates) => {
    const hasPhotoChange = 'photo' in updates

    if (hasPhotoChange) {
      if (updates.photo) {
        saveTempPhoto(id, updates.photo)
        setData(prev => ({
          ...prev,
          products: prev.products.map(p =>
            p.id === id ? { ...p, ...updates, photoUrl: null } : p
          ),
        }))
        uploadPhoto(id, updates.photo)
          .then(photoUrl => {
            deleteTempPhoto(id)
            setData(prev => {
              const products = prev.products.map(p =>
                p.id === id ? { ...p, photoUrl, photo: null } : p
              )
              const updated = products.find(p => p.id === id)
              if (updated) dbSync(syncProduct(updated))
              return { ...prev, products }
            })
          })
          .catch(e => {
            console.error('[YOUSED] photo upload failed:', e.message)
            setData(prev => {
              const product = prev.products.find(p => p.id === id)
              if (product) dbSync(syncProduct(product))
              return prev
            })
          })
      } else {
        deleteTempPhoto(id)
        dbSync(deletePhotoFromStorage(id))
        setData(prev => {
          const products = prev.products.map(p =>
            p.id === id ? { ...p, photo: null, photoUrl: null } : p
          )
          const updated = products.find(p => p.id === id)
          if (updated) dbSync(syncProduct(updated))
          return { ...prev, products }
        })
      }
      return
    }

    setData(prev => ({
      ...prev,
      products: prev.products.map(p => (p.id === id ? { ...p, ...updates } : p)),
    }))

    const isStockUpdate = 'storeStock' in updates || 'stock501' in updates
    if (isStockUpdate) {
      debouncedSync(id)
    } else {
      setData(prev => {
        const product = prev.products.find(p => p.id === id)
        if (product) dbSync(syncProduct(product))
        return prev
      })
    }
  }, [debouncedSync])

  const deleteProduct = useCallback((id) => {
    deleteTempPhoto(id)
    setData(prev => ({ ...prev, products: prev.products.filter(p => p.id !== id) }))
    dbSync(deleteProductFromDb(id))
    dbSync(deletePhotoFromStorage(id))
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
    setData(prev => {
      const equipment = prev.equipment.map(e => (e.id === id ? { ...e, ...updates } : e))
      const updated = equipment.find(e => e.id === id)
      if (updated) dbSync(syncEquipmentItem(updated))
      return { ...prev, equipment }
    })
  }, [])

  const deleteEquipment = useCallback((id) => {
    setData(prev => ({ ...prev, equipment: prev.equipment.filter(e => e.id !== id) }))
    dbSync(deleteEquipmentFromDb(id))
  }, [])

  const categoryProducts = data.products.filter(p => p.category === activeTab)

  return (
    <div className="min-h-dvh bg-[#F4EFE6]">
      <div className="sticky top-0 z-40">
        {/* ── Header ── */}
        <header className="bg-[#2C1A0E] safe-top">
          <div className="px-4 pt-3 pb-2.5 flex items-center justify-between">
            <img src="/logo.png" alt="YOUSED" className="h-8 w-auto object-contain" />
            <div className="flex items-center gap-2.5">
              <span className="text-[#A8998A] text-[11px] tracking-widest font-light">
                {data.products.length} items
              </span>
              {/* DB ロード状態 */}
              {syncStatus === 'loading' && (
                <span className="w-1.5 h-1.5 rounded-full bg-[#C17F55] animate-pulse" title="読込中..." />
              )}
              {syncStatus === 'error' && (
                <span className="w-1.5 h-1.5 rounded-full bg-red-400" title="接続エラー" />
              )}
              {/* Realtime 状態 */}
              {syncStatus === 'ok' && realtimeStatus === 'connected' && (
                <span className="w-1.5 h-1.5 rounded-full bg-[#8B9E6A]" title="リアルタイム同期中" />
              )}
              {syncStatus === 'ok' && realtimeStatus === 'connecting' && (
                <span className="w-1.5 h-1.5 rounded-full bg-[#C17F55] animate-pulse" title="接続中..." />
              )}
              {syncStatus === 'ok' && realtimeStatus === 'error' && (
                <span className="w-1.5 h-1.5 rounded-full bg-[#C17F55] animate-pulse" title="再接続中..." />
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
