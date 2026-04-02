/**
 * db.js — データ永続化レイヤー
 *
 * 設計:
 *  - Supabase DB  : テキストデータ（商品情報・色・レジ・備品）+ photo_url
 *  - Supabase Storage : 写真ファイル（product-photos バケット）
 *  - localStorage : オフライン時フォールバックキャッシュ + アップロード前の一時写真
 */

import { supabase } from './supabase'
import { calcAlert } from '../constants'
import { DEFAULT_COLORS } from '../constants'

const CACHE_KEY  = 'yoused_cache_v2'
const PHOTOS_KEY = 'yoused_photos_v1'   // アップロード前の一時写真
const BUCKET     = 'product-photos'

// ── Supabase Storage ─────────────────────────────────────────────────────────

function base64ToBlob(dataUrl) {
  const [, base64] = dataUrl.split(',')
  const binary = atob(base64)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
  return new Blob([bytes], { type: 'image/jpeg' })
}

export async function uploadPhoto(productId, base64DataUrl) {
  const blob = base64ToBlob(base64DataUrl)
  const path = `${productId}.jpg`

  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(path, blob, { contentType: 'image/jpeg', upsert: true, cacheControl: '3600' })

  if (error) throw new Error(`uploadPhoto: ${error.message}`)

  const { data } = supabase.storage.from(BUCKET).getPublicUrl(path)
  return data.publicUrl
}

export async function deletePhotoFromStorage(productId) {
  const { error } = await supabase.storage.from(BUCKET).remove([`${productId}.jpg`])
  if (error) console.warn('[YOUSED] deletePhotoFromStorage:', error.message)
}

// ── localStorage（一時写真キャッシュ）────────────────────────────────────────

export function loadTempPhotos() {
  try { return JSON.parse(localStorage.getItem(PHOTOS_KEY) || '{}') }
  catch { return {} }
}

export function saveTempPhoto(id, photo) {
  const photos = loadTempPhotos()
  if (photo) photos[id] = photo
  else delete photos[id]
  try { localStorage.setItem(PHOTOS_KEY, JSON.stringify(photos)) }
  catch { /* 容量超過は無視 */ }
}

export function deleteTempPhoto(id) {
  const photos = loadTempPhotos()
  delete photos[id]
  try { localStorage.setItem(PHOTOS_KEY, JSON.stringify(photos)) }
  catch { /* ignore */ }
}

// ── キャッシュ（localStorage）────────────────────────────────────────────────

export function loadCache() {
  try {
    const raw = localStorage.getItem(CACHE_KEY)
    if (!raw) return migrateFromV1()
    return sanitize(JSON.parse(raw))
  } catch { return null }
}

function migrateFromV1() {
  try {
    const raw = localStorage.getItem('yoused_inventory_v1')
    if (!raw) return null
    const p = JSON.parse(raw)
    // 旧フォーマット: 写真が products に埋め込まれている → 一時キャッシュに移行
    const photos = loadTempPhotos()
    if (Array.isArray(p.products)) {
      p.products.forEach(prod => {
        if (prod.photo && !photos[prod.id]) photos[prod.id] = prod.photo
      })
      try { localStorage.setItem(PHOTOS_KEY, JSON.stringify(photos)) } catch { /* ignore */ }
    }
    return sanitize(p)
  } catch { return null }
}

export function saveCache(data) {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify({
      ...data,
      products: data.products.map(({ photo: _p, ...rest }) => rest),
    }))
  } catch (e) { console.error('[YOUSED] saveCache:', e) }
}

function sanitize(p) {
  if (!p || typeof p !== 'object') return null
  return {
    products:  Array.isArray(p.products) ? p.products : [],
    colors:    Array.isArray(p.colors) && p.colors.length > 0 ? p.colors : DEFAULT_COLORS,
    cash: {
      registerAmount: typeof p.cash?.registerAmount === 'number' ? p.cash.registerAmount : 0,
      history: Array.isArray(p.cash?.history) ? p.cash.history : [],
    },
    equipment: Array.isArray(p.equipment) ? p.equipment : [],
  }
}

// Supabaseデータに一時写真（アップロード前）をマージ
export function mergeTempPhotos(data) {
  const photos = loadTempPhotos()
  return {
    ...data,
    products: data.products.map(p => ({
      ...p,
      // photoUrl があれば Storage から表示、なければ一時ローカル写真を使用
      photo: p.photoUrl ? null : (photos[p.id] ?? null),
    })),
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
    products:  (productsRes.data || []).map(parseProductRow),
    colors:    colorsRes.data?.length > 0 ? colorsRes.data : DEFAULT_COLORS,
    cash:      cashRes.data
                 ? { registerAmount: cashRes.data.register_amount ?? 0,
                     history: cashRes.data.history ?? [] }
                 : { registerAmount: 0, history: [] },
    equipment: equipmentRes.data || [],
  }
}

export async function migrateToSupabase(data) {
  await Promise.all([
    ...data.products.map(p => syncProduct(p)),
    ...data.colors
      .filter(c => !DEFAULT_COLORS.find(d => d.id === c.id))
      .map(c => syncColor(c)),
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
    id: color.id, name: color.name, hex: color.hex, sort_order: 999,
  })
  if (error) throw new Error(`syncColor: ${error.message}`)
}

export async function syncCash(cash) {
  const { error } = await supabase.from('cash_data').upsert({
    id: 1,
    register_amount: cash.registerAmount ?? 0,
    history: cash.history ?? [],
    updated_at: new Date().toISOString(),
  })
  if (error) throw new Error(`syncCash: ${error.message}`)
}

export async function syncEquipmentItem(item) {
  const { error } = await supabase.from('equipment').upsert({
    id: item.id, name: item.name ?? '', quantity: item.quantity ?? 0, notes: item.notes ?? '',
  })
  if (error) throw new Error(`syncEquipment: ${error.message}`)
}

export async function deleteEquipmentFromDb(id) {
  const { error } = await supabase.from('equipment').delete().eq('id', id)
  if (error) throw new Error(`deleteEquipment: ${error.message}`)
}

// ── 変換ヘルパー ──────────────────────────────────────────────────────────────

function productToRow(p) {
  const row = {
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
    alert:        p.alert        ?? 'ok',
    updated_at:   new Date().toISOString(),
  }
  // photo_url は実際の URL がある場合のみ送る
  // カラムが未作成の場合でも他フィールドの保存が失敗しないようにするため
  if (p.photoUrl) row.photo_url = p.photoUrl
  return row
}

// Realtime ハンドラからも使えるようにエクスポート
export function parseProductRow(row) {
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
    alert:       row.alert        ?? calcAlert(row.store_stock ?? 0, row.stock_501 ?? 0),
    photo:       null,
    photoUrl:    row.photo_url    ?? null,
  }
}
