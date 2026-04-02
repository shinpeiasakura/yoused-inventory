import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = 'https://fnwfohpldqafdnjtpfla.supabase.co'
const SUPABASE_KEY = 'sb_publishable_j6-7TVo7k4oQ4RlLrGXfqw_sfbqCaOP'

export const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: {
    persistSession:      false,
    autoRefreshToken:    false,
    detectSessionInUrl:  false,
  },
  global: {
    headers: {
      'apikey':        SUPABASE_KEY,
      'Authorization': `Bearer ${SUPABASE_KEY}`,
    },
  },
})

/**
 * 生の fetch で Supabase REST API へ直接アクセスして疎通確認する
 * コンソールに HTTP ステータス・レスポンスボディ・エラーを出力する
 */
export async function testRawConnection() {
  const url = `${SUPABASE_URL}/rest/v1/products?select=id&limit=1`
  console.log('[YOUSED] testRawConnection: GET', url)
  try {
    const res = await fetch(url, {
      method: 'GET',
      headers: {
        'apikey':        SUPABASE_KEY,
        'Authorization': `Bearer ${SUPABASE_KEY}`,
        'Content-Type':  'application/json',
      },
    })
    const body = await res.text()
    console.log(`[YOUSED] testRawConnection: HTTP ${res.status} ${res.statusText}`)
    console.log('[YOUSED] testRawConnection: response body:', body.slice(0, 500))
    if (!res.ok) {
      console.error('[YOUSED] testRawConnection FAILED — status', res.status)
      console.error('[YOUSED] Check: 1) Supabase project is not paused  2) RLS allows anon SELECT  3) table "products" exists')
    }
    return res.ok
  } catch (e) {
    console.error('[YOUSED] testRawConnection threw (network error):', e.message)
    console.error('[YOUSED] Check: internet connection / CORS settings')
    return false
  }
}
