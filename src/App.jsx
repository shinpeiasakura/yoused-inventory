import { useState, useEffect, useRef, useCallback } from 'react'
import CategoryNav from './components/CategoryNav'
import InventoryView from './components/InventoryView'
import CashOtherView from './components/CashOtherView'
import { CATEGORIES, DEFAULT_COLORS, TODAY_SALES_TAB } from './constants'
import {
  loadCache, saveCache, mergeTempPhotos,
  loadFromSupabase, migrateToSupabase,
  uploadPhoto, deletePhotoFromStorage,
  saveTempPhoto, deleteTempPhoto,
  syncProduct, deleteProductFromDb,
  syncSortOrders,
  syncColor,
  syncCash,
  syncEquipmentItem, deleteEquipmentFromDb,
  parseProductRow,
} from './lib/db'
import { subscribeToRealtime } from './lib/realtime'
import TodaySalesView from './components/TodaySalesView'

function genId() { return crypto.randomUUID() }

// ── 当日チェック（在庫変更済みバッジ）────────────────────────────────────────
const CHECKED_KEY = 'yoused_checked_v1'
const isoToday = () => new Date().toISOString().slice(0, 10)

function loadCheckedIds() {
  try {
    const raw = localStorage.getItem(CHECKED_KEY)
    if (!raw) return new Set()
    const { date, ids } = JSON.parse(raw)
    return date === isoToday() ? new Set(ids) : new Set()
  } catch { return new Set() }
}

function saveCheckedIds(ids) {
  try {
    localStorage.setItem(CHECKED_KEY, JSON.stringify({ date: isoToday(), ids: [...ids] }))
  } catch {}
}

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
  const [checkedToday,    setCheckedToday]    = useState(() => loadCheckedIds())

  const dataRef  = useRef(data)
  dataRef.current = data

  // 楽観的UI用: 未送信の在庫変更を追跡し、ポーリング・Realtimeによる上書きを防ぐ
  const pendingStockIds  = useRef(new Set())
  // エラー時のロールバック用スナップショット { [productId]: { storeStock, stock501 } }
  const stockRollbackRef = useRef({})

  // トースト通知
  const [toastMsg,  setToastMsg]  = useState(null)
  const toastTimer = useRef(null)
  const showToast = useCallback((msg) => {
    clearTimeout(toastTimer.current)
    setToastMsg(msg)
    toastTimer.current = setTimeout(() => setToastMsg(null), 4500)
  }, [])

  const debounceTimers = useRef({})
  const debouncedSync = useCallback((id) => {
    clearTimeout(debounceTimers.current[id])
    debounceTimers.current[id] = setTimeout(async () => {
      const product = dataRef.current.products.find(p => p.id === id)
      if (!product) return
      try {
        await syncProduct(product)
        pendingStockIds.current.delete(id)
        delete stockRollbackRef.current[id]
        console.log('[YOUSED] synced:', id)
      } catch (e) {
        console.error('[YOUSED] sync FAILED:', e.message)
        const rollback = stockRollbackRef.current[id]
        pendingStockIds.current.delete(id)
        delete stockRollbackRef.current[id]
        // エラー時: 画面の在庫数を元の値に戻す
        if (rollback) {
          setData(prev => ({
            ...prev,
            products: prev.products.map(p =>
              p.id === id ? { ...p, ...rollback } : p
            ),
          }))
        }
        showToast('在庫の保存に失敗しました。元の数に戻しました。')
      }
    }, 800)
  }, [showToast])

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
            if (!local) return rp
            // pending中の在庫変更をポーリング結果で上書きしない
            if (pendingStockIds.current.has(rp.id)) {
              return { ...rp, storeStock: local.storeStock, stock501: local.stock501, photo: local.photo || null }
            }
            return local.photo ? { ...rp, photo: local.photo } : rp
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
              products: prev.products.map(p => {
                if (p.id !== incoming.id) return p
                // pending中の在庫変更はRealtimeで上書きしない
                if (pendingStockIds.current.has(incoming.id)) {
                  return { ...incoming, storeStock: p.storeStock, stock501: p.stock501, photo: p.photo }
                }
                return { ...incoming, photo: p.photo }
              }),
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
        console.error('[YOUSED] Supabase load failed:', e.message, e)
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

    // ±ボタンからの在庫変更か判定（storeStock/stock501 のみ → true、フォーム保存は他フィールドも含む → false）
    const isStockOnlyUpdate = Object.keys(updates).every(k => k === 'storeStock' || k === 'stock501')
    const isStockUpdate = 'storeStock' in updates || 'stock501' in updates

    // 在庫減少（販売）を検出 → saleDate を今日に自動設定
    let effectiveUpdates = updates
    if (isStockOnlyUpdate) {
      const cur = dataRef.current.products.find(p => p.id === id)
      if (cur) {
        const decreased =
          ('storeStock' in updates && updates.storeStock < (cur.storeStock ?? 0)) ||
          ('stock501'   in updates && updates.stock501   < (cur.stock501   ?? 0))
        if (decreased) {
          effectiveUpdates = { ...updates, saleDate: isoToday() }
        }
      }
    }

    // 楽観的UI: 初回タップ時のみロールバック用スナップショットを保存（saleDate も含む）
    if (isStockOnlyUpdate && !pendingStockIds.current.has(id)) {
      const snap = dataRef.current.products.find(p => p.id === id)
      if (snap) stockRollbackRef.current[id] = { storeStock: snap.storeStock, stock501: snap.stock501, saleDate: snap.saleDate }
    }

    // 即座に画面を更新（Supabase通信の完了を待たない）
    setData(prev => ({
      ...prev,
      products: prev.products.map(p => (p.id === id ? { ...p, ...effectiveUpdates } : p)),
    }))

    if (isStockUpdate) {
      pendingStockIds.current.add(id)
      debouncedSync(id)
      // ±ボタン操作のみチェックバッジを付ける（フォーム保存では付けない）
      if (isStockOnlyUpdate) {
        setCheckedToday(prev => {
          const next = new Set(prev)
          next.add(id)
          saveCheckedIds(next)
          return next
        })
      }
    } else {
      // dataRef.current は最新ステートのスナップショット。
      // updates をマージして syncProduct に渡すことで、setData の非同期タイミングに依存しない。
      const currentProduct = dataRef.current.products.find(p => p.id === id)
      if (currentProduct) {
        dbSync(syncProduct({ ...currentProduct, ...effectiveUpdates }), `updateProduct ${id}`)
      }
    }
  }, [debouncedSync])

  // 並び替え専用: sort_order を一括で更新（個別 syncProduct は使わない）
  const reorderProducts = useCallback((changes) => {
    // changes: [{ id, sortOrder }, ...]
    // ローカルステートを一括更新
    setData(prev => ({
      ...prev,
      products: prev.products.map(p => {
        const c = changes.find(ch => ch.id === p.id)
        return c ? { ...p, sortOrder: c.sortOrder } : p
      }),
    }))
    // Supabase に一括 UPDATE（1回のAPI呼び出しで完結）
    dbSync(syncSortOrders(changes), `reorderProducts (${changes.length}件)`)
  }, [])

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
      {/* エラートースト */}
      {toastMsg && (
        <div
          className="fixed top-4 left-1/2 z-50 px-4 py-3 text-sm font-medium text-white bg-[#C0392B] shadow-lg"
          style={{ transform: 'translateX(-50%)', borderRadius: '4px', maxWidth: 'calc(100vw - 32px)', textAlign: 'center', whiteSpace: 'nowrap' }}
        >
          {toastMsg}
        </div>
      )}
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
        ) : activeTab === TODAY_SALES_TAB ? (
          <TodaySalesView
            products={data.products}
            colors={data.colors}
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
            onReorder={reorderProducts}
            checkedIds={checkedToday}
          />
        )}
      </main>
    </div>
  )
}
