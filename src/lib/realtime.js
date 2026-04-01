import { supabase } from './supabase'

/**
 * subscribeToRealtime
 * Supabase の postgres_changes を監視して、テーブル変更をハンドラに渡す。
 *
 * handler(table, { eventType, new: newRow, old: oldRow })
 *   - table: 'products' | 'colors' | 'cash_data' | 'equipment'
 *   - eventType: 'INSERT' | 'UPDATE' | 'DELETE'
 *
 * @returns cleanup function
 */
export function subscribeToRealtime(handler) {
  const channel = supabase
    .channel('yoused-sync')
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
      if (status === 'SUBSCRIBED') {
        console.log('[YOUSED] Realtime: connected')
      } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
        console.warn('[YOUSED] Realtime:', status)
      }
    })

  return () => supabase.removeChannel(channel)
}
