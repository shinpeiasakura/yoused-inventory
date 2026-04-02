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

function SyncBadge({ color, pulse, label, detail }) {
  return (
    <span
      className="flex items-center gap-1.5"
      title={detail ? `${label}: ${detail}` : label}
    >
      <span
        className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${pulse ? 'animate-pulse' : ''}`}
        style={{ backgroundColor: color }}
      />
      <span className="text-[10px] font-medium tracking-wide" style={{ color }}>
        {label}
      </span>
    </span>
  )
}

function getInitialData() {
  return {
    products:  [],
    colors:    DEFAULT_COLORS,
    cash:      { registerAmount: 0, history: [] },
    equipment: [],
  }
}

function dbSync(promise, label = '') {
  promise
    .then(() => { if (label) console.log('[YOUSED] synced:', label) })
    .catch(e => console.error('[YOUSED] sync FAILED', label, ':', e.message))
}

export default function App() {
  const [activeTab,       setActiveTab]       = useState(CATEGORIES[0])
  const [data,            setData]            = useState(() => mergeTempPhotos(loadCache() ?? getInitialData()))
  const [syncStatus,      setSyncStatus]      = useState('idle')
  const [realtimeStatus,  setRealtimeStatus]  = useState('connecting')
  const [realtimeDetail,  setRealtimeDetail]  = useState('')
  const [lastSyncedAt,    setLastSyncedAt]    = useState(null)

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
  const handleRealtimeStatus = useCallback((status, detail) => {
    setRealtimeStatus(status)
    setRealtimeDetail(detail ?? '')
    if (status === 'connected') setLastSyncedAt(new Date())
  }, [])

  // ── DB から全件再取得（ポーリング・再接続・visibilitychange 共通） ──────────
  const reloadFromDb = useCallback(async (reason) => {
    console.log('[YOUSED] reloadFromDb:', reason)
    try {
      const remote = await loadFromSupabase()
      setData(prev => {
        const merged = mergeTempPhotos({
          ...remote,
          products: remote.products.map(rp => {
            const local = prev.products.find(lp => lp.id === rp.id)
            return local?.photo ? { ...rp, photo: local.photo } : rp
          }),
        })
        return merged
      })
      setLastSyncedAt(new Date())
      console.log('[YOUSED] reloadFromDb: done', reason)
    } catch (e) {
      console.error('[YOUSED] reloadFromDb failed:', e.message)
    }
  }, [])

  const handleReconnect = useCallback(() => {
    reloadFromDb('realtime-reconnect')
  }, [reloadFromDb])

  useEffect(() => {
    return subscribeToRealtime((table, { eventType, new: newRow, old: oldRow }) => {
      setLastSyncedAt(new Date())
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
    }, handleRealtimeStatus, handleReconnect)
  }, [handleRealtimeStatus, handleReconnect])

  // ── 起動時に Supabase からロード ────────────────────────────────────────────
  useEffect(() => {
    async function init() {
      setSyncStatus('loading')
      try {
        const remote = await loadFromSupabase()
        console.log('[YOUSED] init: loaded', remote.products.length, 'products from Supabase')
        const localCache = loadCache()
        if (remote.products.length === 0 && localCache?.products?.length > 0) {
          console.log('[YOUSED] init: migrating local cache to Supabase')
          await migrateToSupabase(localCache)
          const migrated = await loadFromSupabase()
          setData(mergeTempPhotos(migrated))
        } else {
          setData(mergeTempPhotos(remote))
        }
        setLastSyncedAt(new Date())
        setSyncStatus('ok')
      } catch (e) {
        console.error('[YOUSED] Supabase load failed:', e.message)
        setSyncStatus('error')
      }
    }
    init()
  }, [])

  // ── 30秒ポーリング（リアルタイムの補完） ────────────────────────────────────
  useEffect(() => {
    const POLL_INTERVAL = 30_000
    const id = setInterval(() => {
      reloadFromDb('poll-30s')
    }, POLL_INTERVAL)
    return () => clearInterval(id)
  }, [reloadFromDb])

  // ── タブが前面に戻ったとき再取得 ───────────────────────────────────────────
  useEffect(() => {
    const handle = () => {
      if (document.visibilityState === 'visible') {
        reloadFromDb('visibility-visible')
      }
    }
    document.addEventListener('visibilitychange', handle)
    return () => document.removeEventListener('visibilitychange', handle)
  }, [reloadFromDb])

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
            if (updated) dbSync(syncProduct(updated), `addProduct(photo) ${id}`)
            return { ...prev, products }
          })
        })
        .catch(e => {
          console.error('[YOUSED] photo upload failed:', e.message)
          dbSync(syncProduct(newProduct), `addProduct(no-photo) ${id}`)
        })
    } else {
      dbSync(syncProduct(newProduct), `addProduct ${id}`)
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
            <div className="flex items-center gap-3">
              <span className="text-[#A8998A] text-[11px] tracking-widest font-light">
                {data.products.length} items
              </span>

              {/* 同期ステータスバッジ */}
              {syncStatus === 'loading' && (
                <SyncBadge color="#C17F55" pulse label="読込中" />
              )}
              {syncStatus === 'error' && (
                <SyncBadge color="#C0392B" label="DB接続エラー" />
              )}
              {syncStatus === 'ok' && realtimeStatus === 'connected' && (
                <SyncBadge color="#5B8C5A" label="同期中" />
              )}
              {syncStatus === 'ok' && realtimeStatus === 'connecting' && (
                <SyncBadge color="#C17F55" pulse label="接続中..." />
              )}
              {syncStatus === 'ok' && realtimeStatus === 'error' && (
                <SyncBadge color="#C0392B" pulse label="再接続中" detail={realtimeDetail} />
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
