import { useState } from 'react'

function compressImage(file, maxSize = 900, quality = 0.82) {
  return new Promise((resolve) => {
    const reader = new FileReader()
    reader.onload = (ev) => {
      const img = new Image()
      img.onload = () => {
        let { width, height } = img
        if (width > maxSize || height > maxSize) {
          if (width > height) {
            height = Math.round((height * maxSize) / width)
            width = maxSize
          } else {
            width = Math.round((width * maxSize) / height)
            height = maxSize
          }
        }
        const canvas = document.createElement('canvas')
        canvas.width = width
        canvas.height = height
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
        >
          −
        </button>
        <span className="w-6 text-center text-sm font-bold text-[#2C1A0E] tabular-nums">{value}</span>
        <button
          onClick={() => onChange(value + 1)}
          className="w-7 h-7 flex items-center justify-center text-[#F4EFE6] text-lg leading-none bg-[#2C1A0E] active:bg-[#4a2e1a] transition-colors"
          style={{ borderRadius: '2px' }}
          aria-label={`${label}を増やす`}
        >
          +
        </button>
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

/**
 * iOS Safari では input[type="file"] を JavaScript の .click() で
 * 起動できないため、<label> で <input> を直接ラップして
 * ユーザーのタップがそのまま input に伝わるようにする。
 * input は opacity:0 + position:absolute で視覚的に隠しつつ、
 * display:none や visibility:hidden は使わない（iOS で無効化されるため）。
 */
function PhotoInput({ onFile, children, className, style }) {
  const handleChange = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    // 同じファイルを再選択できるようリセット
    e.target.value = ''
    onFile(file)
  }

  return (
    <label className={className} style={{ ...style, position: 'relative', cursor: 'pointer' }}>
      {children}
      {/* iOS Safari 対応: opacity:0 で視覚的に隠し、inset:0 でタップ領域を label 全体に広げる */}
      <input
        type="file"
        accept="image/*"
        onChange={handleChange}
        style={{
          position: 'absolute',
          inset: 0,
          opacity: 0,
          width: '100%',
          height: '100%',
          cursor: 'pointer',
          fontSize: 0,         // iOS Safari でのズーム防止
        }}
      />
    </label>
  )
}

export default function ProductCard({ product, color, onEdit, onDelete, onUpdateStock, onUpdatePhoto }) {
  const [expanded,    setExpanded]    = useState(false)
  const [compressing, setCompressing] = useState(false)

  const totalStock = (product.storeStock || 0) + (product.stock501 || 0)
  const imgSrc = product.photoUrl || product.photo
  // base64 はあるが Storage URL がまだない = アップロード中
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
    <div
      className="bg-[#FDFAF5] overflow-hidden"
      style={{ borderRadius: '3px', boxShadow: '0 1px 4px rgba(44,26,14,0.08)' }}
    >
      <div className="flex gap-0">

        {/* ── 写真エリア ──────────────────────────────────────────── */}
        <div className="relative flex-shrink-0 w-[84px]" style={{ minHeight: '84px' }}>

          {imgSrc ? (
            /* ── 写真あり ──────────────────────────────────── */
            <>
              {/* タップで詳細展開 */}
              <button
                onClick={() => setExpanded(v => !v)}
                className="w-full h-full block"
                style={{ minHeight: '84px' }}
                aria-expanded={expanded}
              >
                <img
                  src={imgSrc}
                  alt={product.name}
                  className="w-full h-full object-cover"
                  style={{ minHeight: '84px', display: 'block' }}
                />
              </button>

              {/* 写真変更ボタン（左下）— label で input を直接ラップ */}
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
            /* ── 写真なし: label 全体がタップ領域 ──────── */
            <PhotoInput
              onFile={handleFile}
              className="w-full h-full flex flex-col items-center justify-center bg-[#F0EBE0] text-[#C4B8A8] gap-1 active:bg-[#EDE7DA] transition-colors"
              style={{ minHeight: '84px' }}
            >
              <CameraIcon size={20} />
              <span style={{ fontSize: '8px', letterSpacing: '0.15em', textTransform: 'uppercase' }}>
                追加
              </span>
            </PhotoInput>
          )}

          {/* アップロード中スピナー */}
          {showSpinner && (
            <div className="absolute inset-0 bg-[#2C1A0E]/40 flex items-center justify-center pointer-events-none">
              <div
                className="w-5 h-5 border-2 rounded-full animate-spin"
                style={{ borderColor: 'rgba(244,239,230,0.3)', borderTopColor: '#F4EFE6' }}
              />
            </div>
          )}

          {/* 在庫バッジ */}
          <div
            className={`absolute top-1.5 right-1.5 min-w-[18px] h-[18px] px-1 flex items-center justify-center text-[9px] font-bold tracking-wide pointer-events-none ${
              totalStock === 0
                ? 'bg-red-500/90 text-white'
                : 'bg-[#2C1A0E]/85 text-[#F4EFE6]'
            }`}
            style={{ borderRadius: '1px' }}
          >
            {totalStock}
          </div>
        </div>

        {/* ── 商品情報エリア ──────────────────────────────────────── */}
        <div className="flex-1 px-3 py-3 min-w-0">
          <div className="flex items-start justify-between gap-1 mb-2">
            <div className="min-w-0">
              <h3 className="font-serif font-medium text-[#2C1A0E] text-[13px] leading-tight truncate">
                {product.name || '名称未設定'}
              </h3>
              <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                {color && (
                  <span className="flex items-center gap-1 text-[10px] text-[#7A6858]">
                    <span
                      className="w-2.5 h-2.5 rounded-full flex-shrink-0 border border-[#DDD5C5]"
                      style={{ backgroundColor: color.hex }}
                    />
                    {color.name}
                  </span>
                )}
                {product.size && (
                  <span
                    className="text-[10px] text-[#7A6858] bg-[#EDE7DA] px-1.5 py-0.5 tracking-wide font-medium"
                    style={{ borderRadius: '1px' }}
                  >
                    {product.size}
                  </span>
                )}
                {product.price ? (
                  <span className="text-[10px] text-[#8B5E3C] font-medium">
                    ¥{Number(product.price).toLocaleString()}
                  </span>
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
            <StockControl
              label="店舗"
              value={product.storeStock || 0}
              onChange={v => onUpdateStock('storeStock', v)}
            />
            <StockControl
              label="501"
              value={product.stock501 || 0}
              onChange={v => onUpdateStock('stock501', v)}
            />
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
          <div className="mt-3 flex justify-end">
            <button
              onClick={onDelete}
              className="text-xs text-[#A8998A] hover:text-red-500 transition-colors px-2 py-1 tracking-wide"
            >
              削除する
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
