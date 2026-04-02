import { supabase } from './supabase'

/**
 * subscribeToRealtime
 *
 * handler(table, payload)
 * onStatusChange(status, detail?)
 *   status: 'connecting' | 'connected' | 'error'
 *   detail: error message string (error時のみ)
 *
 * onReconnect() — 再接続成功時に呼ばれる（DB から最新データを再取得するため）
 *
 * @returns cleanup function
 */
export function subscribeToRealtime(handler, onStatusChange, onReconnect) {
  let channel    = null
  let retryTimer = null
  let destroyed  = false
  let retryCount = 0
  let wasConnected = false  // 一度でも接続成功したか

  function scheduleRetry() {
    // exponential backoff: 2s → 4s → 8s → 16s → 30s (max)
    const delay = Math.min(2000 * Math.pow(2, retryCount), 30000)
    retryCount++
    console.warn(`[YOUSED] Realtime: retry in ${delay / 1000}s (attempt ${retryCount})`)
    retryTimer = setTimeout(() => {
      if (!destroyed) reconnect()
    }, delay)
  }

  function reconnect() {
    if (destroyed) return
    clearTimeout(retryTimer)
    if (channel) {
      supabase.removeChannel(channel).catch(() => {})
      channel = null
    }
    connect()
  }

  function connect() {
    if (destroyed) return
    onStatusChange?.('connecting')

    const name = 'yoused-' + Math.random().toString(36).slice(2, 8)
    console.log('[YOUSED] Realtime: connecting as', name)

    channel = supabase
      .channel(name)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'products'  }, p => handler('products',  p))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'colors'    }, p => handler('colors',    p))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'cash_data' }, p => handler('cash_data', p))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'equipment' }, p => handler('equipment', p))
      .subscribe((status, err) => {
        if (destroyed) return

        console.log('[YOUSED] Realtime status:', status, err ? err.message : '')

        if (status === 'SUBSCRIBED') {
          const isReconnect = wasConnected
          wasConnected = true
          retryCount = 0
          onStatusChange?.('connected')
          // 再接続時は接続中に変化した可能性があるデータを再取得
          if (isReconnect) {
            console.log('[YOUSED] Realtime: reconnected — refreshing data')
            onReconnect?.()
          }

        } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
          const detail = err ? err.message : status
          console.warn('[YOUSED] Realtime:', status, detail)
          onStatusChange?.('error', detail)
          scheduleRetry()
        }
      })
  }

  // ネットワーク復帰時に即座に再接続
  const handleOnline = () => {
    console.log('[YOUSED] Network online — reconnecting realtime')
    reconnect()
  }

  // タブが前面に戻ったとき、切断していれば再接続
  const handleVisibility = () => {
    if (document.visibilityState === 'visible') {
      const state = channel?.state
      if (state && state !== 'joined' && state !== 'joining') {
        console.log('[YOUSED] Tab visible, channel state:', state, '— reconnecting')
        reconnect()
      }
    }
  }

  window.addEventListener('online',             handleOnline)
  document.addEventListener('visibilitychange', handleVisibility)

  connect()

  return () => {
    destroyed = true
    clearTimeout(retryTimer)
    window.removeEventListener('online',             handleOnline)
    document.removeEventListener('visibilitychange', handleVisibility)
    if (channel) supabase.removeChannel(channel).catch(() => {})
  }
}
