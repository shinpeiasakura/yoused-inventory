import { supabase } from './supabase'

/**
 * subscribeToRealtime
 * Supabase の postgres_changes を監視して、テーブル変更をハンドラに渡す。
 *
 * handler(table, { eventType, new: newRow, old: oldRow })
 * onStatusChange(status) - 'connected' | 'connecting' | 'error'
 *
 * @returns cleanup function
 */
export function subscribeToRealtime(handler, onStatusChange) {
  let channel = null
  let retryTimer = null
  let destroyed = false

  function connect() {
    if (destroyed) return
    onStatusChange?.('connecting')

    channel = supabase
      .channel('yoused-sync-' + Math.random().toString(36).slice(2, 7))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'products' },
        payload => handler('products', payload)
      )
      .on('postgres_changes', { event: '*', schema: 'public', table: 'colors' },
        payload => handler('colors', payload)
      )
      .on('postgres_changes', { event: '*', schema: 'public', table: 'cash_data' },
        payload => handler('cash_data', payload)
      )
      .on('postgres_changes', { event: '*', schema: 'public', table: 'equipment' },
        payload => handler('equipment', payload)
      )
      .subscribe(status => {
        if (destroyed) return
        if (status === 'SUBSCRIBED') {
          console.log('[YOUSED] Realtime: connected')
          onStatusChange?.('connected')
        } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
          console.warn('[YOUSED] Realtime:', status, '— retrying in 5s')
          onStatusChange?.('error')
          // 5秒後に再接続
          retryTimer = setTimeout(() => {
            if (!destroyed) {
              supabase.removeChannel(channel)
              connect()
            }
          }, 5000)
        }
      })
  }

  connect()

  return () => {
    destroyed = true
    clearTimeout(retryTimer)
    if (channel) supabase.removeChannel(channel)
  }
}
