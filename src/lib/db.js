/**
 * db.js — データ永続化レイヤー
 *
 * 設計:
 *  - Supabase: テキストデータ（商品情報・色・レジ・備品）のソース・オブ・トゥルース
 *  - localStorage: 写真(base64)のみ + オフライン時のフォールバックキャッシュ
 *  - 写真はDBに保存しない（サイズが大きすぎるため）
 */

import { supabase } from './supabase'
import { DEFAULT_COLORS } from '../constants'

const CACHE_KEY  = 'yoused_cache_v2'   // テキストデータのキャッシュ
const PHOTOS_KEY = 'yoused_photos_v1'  // 写真データ

// ── 写真（localStorage のみ）─────────────────────────────────────────────────

export function loadPhotos() {
  try {
    return JSON.parse(localStorage.getItem(PHOTOS_KEY) || '{}')
  } catch {
    return {}
  }
}

export function savePhoto(id, photo) {
  const photos = loadPhotos()
  if (photo) {
    photos[id] = photo
  } else {
    delete photos[id]
  }
  try {
    localStorage.setItem(PHOTOS_KEY, JSON.stringify(photos))
  } catch {
    // 容量超過時は古いデータを削除して再試行
    try {
      localStorage.setItem(PHOTOS_KEY, JSON.stringify({ [id]: photo }))
    } catch {
      console.warn('[YOUSED] 写真の保存に失敗しました（容量不足）')
    }
  }
}

export function deletePhoto(id) {
  const photos = loadPhotos()
  delete photos[id]
  try {
    localStorage.setItem(PHOTOS_KEY, JSON.stringify(photos))
  } catch { /* ignore */ }
}

// ── キャッシュ（localStorage）────────────────────────────────────────────────

export function loadCache() {
  try {
    const raw = localStorage.getItem(CACHE_KEY)
    if (!raw) {
      // 旧フォーマット（yoused_inventory_v1）からの移行を試みる
      return migrateFromV1()
    }
    const p = JSON.parse(raw)
    return sanitize(p)
  } catch {
    return null
  }
}

function migrateFromV1() {
  try {
    const raw = localStorage.getItem('yoused_inventory_v1')
    if (!raw) return null
    const p = JSON.parse(raw)
    // 旧フォーマットには写真が products に埋め込まれている → 分離して保存
    const photos = loadPhotos()
    if (Array.isArray(p.products)) {
      p.products.forEach(prod => {
        if (prod.photo && !photos[prod.id]) {
          photos[prod.id] = prod.photo
        }
      })
      try { localStorage.setItem(PHOTOS_KEY, JSON.stringify(photos)) } catch { /* ignore */ }
    }
    return sanitize(p)
  } catch {
    return null
  }
}

export function saveCache(data) {
  try {
    // 写真を除いてキャッシュ保存
    const payload = {
      ...data,
      products: data.products.map(({ photo: _photo, ...rest }) => rest),
    }
    localStorage.setItem(CACHE_KEY, JSON.stringify(payload))
  } catch (e) {
    console.error('[YOUSED] キャッシュ保存失敗:', e)
  }
}

function sanitize(p) {
  if (!p || typeof p !== 'object') return null
  return {
    products:  Array.isArray(p.products)  ? p.products  : [],
    colors:    Array.isArray(p.colors) && p.colors.length > 0 ? p.colors : DEFAULT_COLORS,
    cash: {
      registerAmount: typeof p.cash?.registerAmount === 'number' ? p.cash.registerAmount : 0,
      history: Array.isArray(p.cash?.history) ? p.cash.history : [],
    },
    equipment: Array.isArray(p.equipment) ? p.equipment : [],
  }
}

// 写真をキャッシュデータにマージして返す
export function mergePhotos(data) {
  const photos = loadPhotos()
  return {
    ...data,
    products: data.products.map(p => ({ ...p, photo: photos[p.id] ?? null })),
  }
}

// ── Supabase（リモート）──────────────────────────────────────────────────────

export async function loadFromSupabase() {
  const [productsRes, colorsRes, cashRes, equipmentRes] = await Promise.all([
    supabase.from('products').select('*'),
    supabase.from('colors').select('*').order('sort_order'),
    supabase.from('cash_data').select('*').eq('id', 1).maybeSingle(),
    supabase.from('equipment').select('*'),
  ])

  if (productsRes.error)  throw new Error(`products: ${productsRes.error.message}`)
  if (colorsRes.error)    throw new Error(`colors: ${colorsRes.error.message}`)
  if (equipmentRes.error) throw new Error(`equipment: ${equipmentRes.error.message}`)

  return {
    products:  (productsRes.data  || []).map(dbRowToProduct),
    colors:    colorsRes.data?.length  > 0 ? colorsRes.data : DEFAULT_COLORS,
    cash:      cashRes.data
                 ? { registerAmount: cashRes.data.register_amount ?? 0,
                     history: cashRes.data.history ?? [] }
                 : { registerAmount: 0, history: [] },
    equipment: equipmentRes.data || [],
  }
}

// ローカルデータを Supabase に一括移行（初回セットアップ用）
export async function migrateToSupabase(data) {
  const productOps = data.products.map(p => syncProduct(p))
  const colorOps   = data.colors
    .filter(c => !DEFAULT_COLORS.find(d => d.id === c.id))  // カスタムカラーのみ
    .map(c => syncColor(c))

  await Promise.all([
    ...productOps,
    ...colorOps,
    syncCash(data.cash),
    ...data.equipment.map(e => syncEquipmentItem(e)),
  ])
}

// ── Supabase CRUD ─────────────────────────────────────────────────────────────

export async function syncProduct(product) {
  const { error } = await supabase.from('products').upsert(productToRow(product))
  if (error) throw new Error(`syncProduct: ${error.message}`)
}

export async function deleteProductFromDb(id) {
  const { error } = await supabase.from('products').delete().eq('id', id)
  if (error) throw new Error(`deleteProduct: ${error.message}`)
}

export async function syncColor(color) {
  const { error } = await supabase.from('colors').upsert({
    id:         color.id,
    name:       color.name,
    hex:        color.hex,
    sort_order: 999,
  })
  if (error) throw new Error(`syncColor: ${error.message}`)
}

export async function syncCash(cash) {
  const { error } = await supabase.from('cash_data').upsert({
    id:              1,
    register_amount: cash.registerAmount ?? 0,
    history:         cash.history ?? [],
    updated_at:      new Date().toISOString(),
  })
  if (error) throw new Error(`syncCash: ${error.message}`)
}

export async function syncEquipmentItem(item) {
  const { error } = await supabase.from('equipment').upsert({
    id:       item.id,
    name:     item.name     ?? '',
    quantity: item.quantity ?? 0,
    notes:    item.notes    ?? '',
  })
  if (error) throw new Error(`syncEquipment: ${error.message}`)
}

export async function deleteEquipmentFromDb(id) {
  const { error } = await supabase.from('equipment').delete().eq('id', id)
  if (error) throw new Error(`deleteEquipment: ${error.message}`)
}

// ── 変換ヘルパー ──────────────────────────────────────────────────────────────

function productToRow(p) {
  return {
    id:           p.id,
    category:     p.category     ?? '',
    color_id:     p.colorId      ?? '',
    name:         p.name         ?? '',
    size:         p.size         ?? '',
    store_stock:  p.storeStock   ?? 0,
    stock_501:    p.stock501     ?? 0,
    arrival_date: p.arrivalDate  ?? '',
    sale_date:    p.saleDate     ?? '',
    price:        p.price        ?? null,
    notes:        p.notes        ?? '',
    updated_at:   new Date().toISOString(),
    // photo は保存しない
  }
}

function dbRowToProduct(row) {
  return {
    id:          row.id,
    category:    row.category     ?? '',
    colorId:     row.color_id     ?? '',
    name:        row.name         ?? '',
    size:        row.size         ?? '',
    storeStock:  row.store_stock  ?? 0,
    stock501:    row.stock_501    ?? 0,
    arrivalDate: row.arrival_date ?? '',
    saleDate:    row.sale_date    ?? '',
    price:       row.price        ?? null,
    notes:       row.notes        ?? '',
    photo:       null,  // 写真は localStorage から別途マージ
  }
}
