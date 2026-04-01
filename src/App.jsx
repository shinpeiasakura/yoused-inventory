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
} from './lib/db'

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
  const [activeTab,  setActiveTab]  = useState(CATEGORIES[0])
  const [data,       setData]       = useState(() => mergeTempPhotos(loadCache() ?? getInitialData()))
  const [syncStatus, setSyncStatus] = useState('idle')

  const dataRef  = useRef(data)
  dataRef.current = data

  // +/− の連打をデバウンスして Supabase への書き込みを間引く
  const debounceTimers = useRef({})
  const debouncedSync = useCallback((id) => {
    clearTimeout(debounceTimers.current[id])
    debounceTimers.current[id] = setTimeout(() => {
      const product = dataRef.current.products.find(p => p.id === id)
      if (product) dbSync(syncProduct(product))
    }, 800)
  }, [])

  // data 変化時にキャッシュ保存
  useEffect(() => { saveCache(data) }, [data])

  // ページ離脱前に確実に保存
  useEffect(() => {
    const flush = () => saveCache(dataRef.current)
    window.addEventListener('beforeunload', flush)
    return () => window.removeEventListener('beforeunload', flush)
  }, [])

  // 起動時に Supabase からロード
  useEffect(() => {
    async function init() {
      setSyncStatus('loading')
      try {
        const remote = await loadFromSupabase()

        // Supabase が空 & ローカルにデータあり → 初回移行
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
    // photo は一時的に base64 で表示、photoUrl は Storage アップロード後に設定
    const newProduct = { ...product, id, photoUrl: null }

    if (newProduct.photo) {
      saveTempPhoto(id, newProduct.photo)  // オフライン時の備え
    }

    setData(prev => ({ ...prev, products: [...prev.products, newProduct] }))

    if (newProduct.photo) {
      // 写真をアップロードして photo_url を更新
      uploadPhoto(id, newProduct.photo)
        .then(photoUrl => {
          deleteTempPhoto(id)  // アップロード済みなのでローカルキャッシュ削除
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
          // アップロード失敗でも商品自体は保存
          console.error('[YOUSED] photo upload failed:', e.message)
          dbSync(syncProduct(newProduct))
        })
    } else {
      dbSync(syncProduct(newProduct))
    }
  }, [])

  const updateProduct = useCallback((id, updates) => {
    const hasPhotoChange = 'photo' in updates

    // 写真の更新処理
    if (hasPhotoChange) {
      if (updates.photo) {
        // 新しい写真 → 一時保存 & アップロード
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
        // 写真を削除
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

    // 写真以外の更新
    setData(prev => ({
      ...prev,
      products: prev.products.map(p => (p.id === id ? { ...p, ...updates } : p)),
    }))

    // 在庫数は連打されるのでデバウンス、それ以外は即時同期
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
              {syncStatus === 'loading' && (
                <span className="w-1.5 h-1.5 rounded-full bg-yellow-400 animate-pulse" title="同期中..." />
              )}
              {syncStatus === 'ok' && (
                <span className="w-1.5 h-1.5 rounded-full bg-green-400" title="同期済み" />
              )}
              {syncStatus === 'error' && (
                <span className="w-1.5 h-1.5 rounded-full bg-red-400" title="オフライン" />
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
