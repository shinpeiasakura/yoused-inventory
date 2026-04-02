import { useState, useRef } from 'react'
import { ALERT_CONFIG, calcAlert } from '../constants'

function compressImage(file, maxSize = 900, quality = 0.82) {
  return new Promise((resolve) => {
    const reader = new FileReader()
    reader.onload = (ev) => {
      const img = new Image()
      img.onload = () => {
        let { width, height } = img
        if (width > maxSize || height > maxSize) {
          if (width > height) { height = Math.round((height * maxSize) / width); width = maxSize }
          else { width = Math.round((width * maxSize) / height); height = maxSize }
        }
        const canvas = document.createElement('canvas')
        canvas.width = width; canvas.height = height
        canvas.getContext('2d').drawImage(img, 0, 0, width, height)
        resolve(canvas.toDataURL('image/jpeg', quality))
      }
      img.src = ev.target.result
    }
    reader.readAsDataURL(file)
  })
}

function StockControl({ label, value, onChange }) {
  return (
    <div className="flex flex-col items-center gap-1">
      <span className="text-[9px] text-[#A8998A] font-medium tracking-widest uppercase">{label}</span>
      <div className="flex items-center gap-2">
        <button
          onClick={() => onChange(Math.max(0, value - 1))}
          className="w-7 h-7 flex items-center justify-center text-[#7A6858] text-lg leading-none bg-[#EDE7DA] active:bg-[#DDD5C5] transition-colors"
          style={{ borderRadius: '2px' }}
          aria-label={`${label}を減らす`}
        >−</button>
        <span className="w-6 text-center text-sm font-bold text-[#2C1A0E] tabular-nums">{value}</span>
        <button
          onClick={() => onChange(value + 1)}
          className="w-7 h-7 flex items-center justify-center text-[#F4EFE6] text-lg leading-none bg-[#2C1A0E] active:bg-[#4a2e1a] transition-colors"
          style={{ borderRadius: '2px' }}
          aria-label={`${label}を増やす`}
        >+</button>
      </div>
    </div>
  )
}

function CameraIcon({ size = 14 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" style={{ flexShrink: 0 }}>
      <path d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z"/>
      <circle cx="12" cy="13" r="4"/>
    </svg>
  )
}

function PhotoInput({ onFile, children, className, style }) {
  const handleChange = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    e.target.value = ''
    onFile(file)
  }
  return (
    <label className={className} style={{ ...style, position: 'relative', cursor: 'pointer' }}>
      {children}
      <input
        type="file"
        accept="image/*"
        onChange={handleChange}
        style={{ position: 'absolute', inset: 0, opacity: 0, width: '100%', height: '100%', cursor: 'pointer', fontSize: 0 }}
      />
    </label>
  )
}

// ── スワイプ削除の定数 ─────────────────────────────────────────────────────────
const SWIPE_REVEAL = 80   // 削除ボタンの幅 (px)
const SWIPE_THRESH = 40   // スワイプ開閉の閾値 (px)

export default function ProductCard({ product, color, onEdit, onDelete, onUpdateStock, onUpdatePhoto }) {
  const [expanded,    setExpanded]    = useState(false)
  const [compressing, setCompressing] = useState(false)

  // ── スワイプ状態 ────────────────────────────────────────────────────────────
  const [swipeX,    setSwipeX]    = useState(0)
  const [swipeAnim, setSwipeAnim] = useState(false)
  const [swipeOpen, setSwipeOpen] = useState(false)
  const touch = useRef({ startX: 0, startY: 0, baseX: 0, dragging: false, dir: null })

  const openSwipe  = () => { setSwipeX(-SWIPE_REVEAL); setSwipeOpen(true);  setSwipeAnim(true) }
  const closeSwipe = () => { setSwipeX(0);             setSwipeOpen(false); setSwipeAnim(true) }

  const onTouchStart = (e) => {
    const t = e.touches[0]
    touch.current = {
      startX:   t.clientX,
      startY:   t.clientY,
      baseX:    swipeOpen ? -SWIPE_REVEAL : 0,
      dragging: false,
      dir:      null,
    }
    setSwipeAnim(false)
  }

  const onTouchMove = (e) => {
    const tc = touch.current
    const dx = e.touches[0].clientX - tc.startX
    const dy = e.touches[0].clientY - tc.startY

    if (!tc.dir) {
      if (Math.abs(dx) < 4 && Math.abs(dy) < 4) return
      tc.dir = Math.abs(dx) >= Math.abs(dy) ? 'h' : 'v'
    }
    if (tc.dir !== 'h') return

    tc.dragging = true
    // 左方向のみ許可（右スワイプは 0 で止める）
    setSwipeX(Math.min(0, Math.max(-SWIPE_REVEAL, tc.baseX + dx)))
  }

  const onTouchEnd = () => {
    const { dragging, dir } = touch.current

    if (!dragging) {
      // タップ（ドラッグなし）: 開いていたら閉じる
      if (swipeOpen) closeSwipe()
      return
    }
    if (dir !== 'h') return

    // 閾値を超えたら開く、そうでなければ閉じる
    if (swipeX < -SWIPE_THRESH) openSwipe()
    else closeSwipe()
  }

  // ── 写真 ────────────────────────────────────────────────────────────────────
  const totalStock = (product.storeStock || 0) + (product.stock501 || 0)
  const alertKey = product.alert ?? calcAlert(product.storeStock, product.stock501)
  const alertCfg = ALERT_CONFIG[alertKey] ?? ALERT_CONFIG['ok']
  const imgSrc = product.photoUrl || product.photo
  const uploadingToStorage = !!product.photo && !product.photoUrl
  const showSpinner = compressing || uploadingToStorage

  const handleFile = async (file) => {
    setCompressing(true)
    try {
      const base64 = await compressImage(file)
      onUpdatePhoto(base64)
    } finally {
      setCompressing(false)
    }
  }

  return (
    // 外側: 削除ボタン + スライドするカード を重ねるコンテナ
    <div style={{ position: 'relative', borderRadius: '3px', overflow: 'hidden', boxShadow: '0 1px 4px rgba(44,26,14,0.08)' }}>

      {/* ── 削除ボタン（カードの後ろに固定）── */}
      <div
        style={{ position: 'absolute', right: 0, top: 0, bottom: 0, width: SWIPE_REVEAL, background: '#c0392b', display: 'flex', alignItems: 'stretch' }}
        aria-hidden={!swipeOpen}
      >
        <button
          onClick={onDelete}
          style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: '#fff', gap: '3px' }}
          aria-label="削除"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
            <polyline points="3 6 5 6 21 6"/>
            <path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/>
            <path d="M10 11v6M14 11v6"/>
            <path d="M9 6V4a1 1 0 011-1h4a1 1 0 011 1v2"/>
          </svg>
          <span style={{ fontSize: '10px', letterSpacing: '0.05em' }}>削除</span>
        </button>
      </div>

      {/* ── スライドするカード本体 ── */}
      <div
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
        style={{
          transform:   `translateX(${swipeX}px)`,
          transition:  swipeAnim ? 'transform 0.22s ease' : 'none',
          touchAction: 'pan-y',    // 縦スクロールはブラウザ任せ、横はJSで処理
          position:    'relative',
          zIndex:      1,
          backgroundColor: '#FDFAF5',
        }}
      >
        <div className="flex gap-0">

          {/* ── 写真エリア ───────────────────────────────────── */}
          <div className="relative flex-shrink-0 w-[84px]" style={{ minHeight: '84px' }}>
            {imgSrc ? (
              <>
                <button
                  onClick={() => setExpanded(v => !v)}
                  className="w-full h-full block"
                  style={{ minHeight: '84px' }}
                  aria-expanded={expanded}
                >
                  <img src={imgSrc} alt={product.name} className="w-full h-full object-cover" style={{ minHeight: '84px', display: 'block' }} />
                </button>
                {!showSpinner && (
                  <PhotoInput
                    onFile={handleFile}
                    className="absolute bottom-1.5 left-1.5 w-7 h-7 bg-[#2C1A0E]/65 backdrop-blur-sm flex items-center justify-center text-[#F4EFE6] active:bg-[#2C1A0E]/90 overflow-hidden"
                    style={{ borderRadius: '2px' }}
                  >
                    <CameraIcon size={13} />
                  </PhotoInput>
                )}
              </>
            ) : (
              <PhotoInput
                onFile={handleFile}
                className="w-full h-full flex flex-col items-center justify-center bg-[#F0EBE0] text-[#C4B8A8] gap-1 active:bg-[#EDE7DA] transition-colors"
                style={{ minHeight: '84px' }}
              >
                <CameraIcon size={20} />
                <span style={{ fontSize: '8px', letterSpacing: '0.15em', textTransform: 'uppercase' }}>追加</span>
              </PhotoInput>
            )}

            {showSpinner && (
              <div className="absolute inset-0 bg-[#2C1A0E]/40 flex items-center justify-center pointer-events-none">
                <div className="w-5 h-5 border-2 rounded-full animate-spin" style={{ borderColor: 'rgba(244,239,230,0.3)', borderTopColor: '#F4EFE6' }} />
              </div>
            )}

            <div
              className={`absolute top-1.5 right-1.5 min-w-[18px] h-[18px] px-1 flex items-center justify-center text-[9px] font-bold tracking-wide pointer-events-none ${totalStock === 0 ? 'bg-red-500/90 text-white' : 'bg-[#2C1A0E]/85 text-[#F4EFE6]'}`}
              style={{ borderRadius: '1px' }}
            >
              {totalStock}
            </div>
          </div>

          {/* ── 商品情報エリア ──────────────────────────────── */}
          <div className="flex-1 px-3 py-3 min-w-0">
            <div className="flex items-start justify-between gap-1 mb-2">
              <div className="min-w-0">
                <h3 className="font-serif font-medium text-[#2C1A0E] text-[13px] leading-tight truncate">
                  {product.name || '名称未設定'}
                </h3>
                <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                  {color && (
                    <span className="flex items-center gap-1 text-[10px] text-[#7A6858]">
                      <span className="w-2.5 h-2.5 rounded-full flex-shrink-0 border border-[#DDD5C5]" style={{ backgroundColor: color.hex }} />
                      {color.name}
                    </span>
                  )}
                  {product.size && (
                    <span className="text-[10px] text-[#7A6858] bg-[#EDE7DA] px-1.5 py-0.5 tracking-wide font-medium" style={{ borderRadius: '1px' }}>
                      {product.size}
                    </span>
                  )}
                  <span
                    className="flex items-center gap-1 text-[10px] font-medium px-1.5 py-0.5"
                    style={{ borderRadius: '2px', backgroundColor: alertCfg.bg, color: alertCfg.text }}
                  >
                    <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ backgroundColor: alertCfg.dot }} />
                    {alertCfg.label}
                  </span>
                  {product.price ? (
                    <span className="text-[10px] text-[#8B5E3C] font-medium">¥{Number(product.price).toLocaleString()}</span>
                  ) : null}
                </div>
              </div>
              <button
                onClick={onEdit}
                className="flex-shrink-0 w-7 h-7 flex items-center justify-center text-[#C4B8A8] hover:text-[#8B5E3C] transition-colors"
                aria-label="編集"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                  <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/>
                  <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/>
                </svg>
              </button>
            </div>

            <div className="flex gap-4">
              <StockControl label="店舗" value={product.storeStock || 0} onChange={v => onUpdateStock('storeStock', v)} />
              <StockControl label="501"  value={product.stock501  || 0} onChange={v => onUpdateStock('stock501',  v)} />
            </div>
          </div>
        </div>

        {/* 詳細展開パネル */}
        {expanded && (
          <div className="border-t border-[#EDE7DA] px-4 py-3 bg-[#F4EFE6]">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <p className="text-[9px] text-[#A8998A] mb-0.5 tracking-widest uppercase">入荷日</p>
                <p className="font-medium text-[#2C1A0E] text-xs">{product.arrivalDate || '—'}</p>
              </div>
              <div>
                <p className="text-[9px] text-[#A8998A] mb-0.5 tracking-widest uppercase">販売日</p>
                <p className="font-medium text-[#2C1A0E] text-xs">{product.saleDate || '—'}</p>
              </div>
              {product.notes ? (
                <div className="col-span-2">
                  <p className="text-[9px] text-[#A8998A] mb-0.5 tracking-widest uppercase">メモ</p>
                  <p className="text-[#7A6858] whitespace-pre-wrap text-xs">{product.notes}</p>
                </div>
              ) : null}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
