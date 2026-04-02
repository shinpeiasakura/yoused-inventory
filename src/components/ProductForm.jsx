import { useState, useRef } from 'react'

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

const LABEL_CLS = 'block text-[9px] font-semibold text-[#A8998A] mb-2 tracking-widest uppercase'
const INPUT_CLS =
  'w-full px-4 py-3 border border-[#DDD5C5] text-sm bg-[#FDFAF5] text-[#2C1A0E] focus:outline-none focus:border-[#8B5E3C] focus:ring-1 focus:ring-[#8B5E3C]/20 placeholder:text-[#C4B8A8] transition-colors'

// ── サイズ行の在庫コントロール ──────────────────────────────────────────────────
function InlineStock({ label, value, onChange }) {
  return (
    <div className="flex flex-col items-center gap-1">
      <span className="text-[9px] text-[#A8998A] tracking-widest uppercase">{label}</span>
      <div className="flex items-center gap-1.5">
        <button
          type="button"
          onClick={() => onChange(Math.max(0, value - 1))}
          className="w-7 h-7 flex items-center justify-center text-[#7A6858] text-base leading-none bg-[#EDE7DA] active:bg-[#DDD5C5]"
          style={{ borderRadius: '2px' }}
        >
          −
        </button>
        <span className="w-6 text-center text-sm font-bold text-[#2C1A0E] tabular-nums select-none">{value}</span>
        <button
          type="button"
          onClick={() => onChange(value + 1)}
          className="w-7 h-7 flex items-center justify-center text-[#F4EFE6] text-base leading-none bg-[#2C1A0E] active:bg-[#4a2e1a]"
          style={{ borderRadius: '2px' }}
        >
          +
        </button>
      </div>
    </div>
  )
}

// ── 1サイズ行（追加モード用）─────────────────────────────────────────────────
function SizeRow({ row, onChange, onDelete, canDelete, index }) {
  return (
    <div className="p-3 bg-[#F4EFE6] border border-[#DDD5C5] flex items-center gap-3" style={{ borderRadius: '2px' }}>
      {/* サイズ入力 */}
      <div className="flex-shrink-0">
        <div className="text-[9px] text-[#A8998A] tracking-widest uppercase mb-1">SIZE</div>
        <input
          type="text"
          value={row.size}
          onChange={e => onChange({ ...row, size: e.target.value })}
          placeholder="M"
          className="w-16 px-2 py-1.5 border border-[#DDD5C5] text-sm font-medium bg-[#FDFAF5] text-[#2C1A0E] text-center focus:outline-none focus:border-[#8B5E3C] placeholder:text-[#C4B8A8]"
          style={{ borderRadius: '2px' }}
        />
      </div>

      {/* 在庫コントロール */}
      <div className="flex flex-1 justify-around gap-2">
        <InlineStock
          label="店舗"
          value={row.storeStock}
          onChange={v => onChange({ ...row, storeStock: v })}
        />
        <InlineStock
          label="501"
          value={row.stock501}
          onChange={v => onChange({ ...row, stock501: v })}
        />
      </div>

      {/* 削除ボタン */}
      <button
        type="button"
        onClick={onDelete}
        disabled={!canDelete}
        className={`flex-shrink-0 w-7 h-7 flex items-center justify-center text-lg transition-colors ${
          canDelete
            ? 'text-[#C4B8A8] hover:text-red-400 active:text-red-500'
            : 'text-[#EDE7DA] cursor-default'
        }`}
        aria-label={`サイズ${index + 1}を削除`}
      >
        ×
      </button>
    </div>
  )
}

// ── メインフォーム ─────────────────────────────────────────────────────────────
export default function ProductForm({ product, category, colors, onSave, onCancel, onAddColor }) {
  const isEditing = !!product
  const fileRef = useRef(null)

  // 共通フィールド（名前・色・写真・日付・価格・メモ）
  const [form, setForm] = useState({
    name:        product?.name        ?? '',
    colorId:     product?.colorId     ?? (colors[0]?.id ?? ''),
    arrivalDate: product?.arrivalDate ?? '',
    saleDate:    product?.saleDate    ?? '',
    price:       product?.price       ?? '',
    notes:       product?.notes       ?? '',
    photo:       product?.photo       ?? null,
    // 編集モードのみ使うシングルフィールド
    size:        product?.size        ?? '',
    storeStock:  product?.storeStock  ?? 0,
    stock501:    product?.stock501    ?? 0,
  })

  // 追加モード専用: 複数サイズ行
  const [sizes, setSizes] = useState([
    { _key: crypto.randomUUID(), size: '', storeStock: 0, stock501: 0 },
  ])

  const [addingColor, setAddingColor] = useState(false)
  const [newColorName, setNewColorName] = useState('')
  const [newColorHex, setNewColorHex] = useState('#888888')
  const [photoLoading, setPhotoLoading] = useState(false)

  const set = (key, value) => setForm(f => ({ ...f, [key]: value }))

  const handlePhotoChange = async (e) => {
    const file = e.target.files[0]
    if (!file) return
    setPhotoLoading(true)
    try {
      const compressed = await compressImage(file)
      set('photo', compressed)
    } finally {
      setPhotoLoading(false)
    }
  }

  const handleAddColor = () => {
    const name = newColorName.trim()
    if (!name) return
    const exists = colors.find(c => c.name.toLowerCase() === name.toLowerCase())
    if (!exists) onAddColor({ name, hex: newColorHex })
    setNewColorName('')
    setNewColorHex('#888888')
    setAddingColor(false)
  }

  // サイズ行の操作
  const updateSize = (key, updated) =>
    setSizes(prev => prev.map(r => r._key === key ? { ...r, ...updated } : r))
  const deleteSize = (key) =>
    setSizes(prev => prev.filter(r => r._key !== key))
  const addSizeRow = () =>
    setSizes(prev => [...prev, { _key: crypto.randomUUID(), size: '', storeStock: 0, stock501: 0 }])

  const handleSubmit = (e) => {
    e.preventDefault()

    const shared = {
      name:        form.name,
      colorId:     form.colorId,
      photo:       form.photo,
      arrivalDate: form.arrivalDate,
      saleDate:    form.saleDate,
      price:       form.price !== '' ? Number(form.price) : null,
      notes:       form.notes,
    }

    if (isEditing) {
      // 編集: 単一商品を更新
      onSave({
        ...shared,
        size:       form.size,
        storeStock: Math.max(0, Number(form.storeStock) || 0),
        stock501:   Math.max(0, Number(form.stock501)   || 0),
      })
    } else {
      // 追加: サイズ行ごとに商品を作成
      onSave({
        ...shared,
        sizes: sizes.map(r => ({
          size:       r.size,
          storeStock: Math.max(0, r.storeStock),
          stock501:   Math.max(0, r.stock501),
        })),
      })
    }
  }

  return (
    <form onSubmit={handleSubmit} className="px-5 pt-4 pb-8 space-y-5">
      {/* Category badge */}
      <div className="flex items-center justify-between">
        <p className="text-[9px] text-[#A8998A] tracking-widest uppercase font-medium">Category</p>
        <span className="text-[10px] bg-[#EDE7DA] text-[#7A6858] px-2.5 py-1 tracking-widest uppercase font-medium" style={{ borderRadius: '2px' }}>
          {category}
        </span>
      </div>

      {/* Photo */}
      <div>
        <label className={LABEL_CLS}>写真</label>
        <button
          type="button"
          onClick={() => fileRef.current.click()}
          className="w-full h-44 overflow-hidden border border-dashed border-[#DDD5C5] bg-[#F4EFE6] flex items-center justify-center active:opacity-80 transition-opacity relative"
          style={{ borderRadius: '2px' }}
        >
          {photoLoading ? (
            <div className="text-[#A8998A] text-sm tracking-wide">読み込み中...</div>
          ) : form.photo ? (
            <>
              <img src={form.photo} alt="product" className="w-full h-full object-cover" />
              <div className="absolute inset-0 bg-[#2C1A0E]/20 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity">
                <span className="text-[#F4EFE6] text-xs font-medium bg-[#2C1A0E]/60 px-3 py-1 tracking-widest uppercase" style={{ borderRadius: '1px' }}>変更</span>
              </div>
            </>
          ) : (
            <div className="text-center text-[#C4B8A8]">
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2" className="mx-auto mb-2">
                <path d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z"/>
                <circle cx="12" cy="13" r="4"/>
              </svg>
              <p className="text-xs tracking-wide">タップして写真を追加</p>
              <p className="text-[10px] mt-0.5 text-[#D4C9B8] tracking-wide">カメラまたはライブラリ</p>
            </div>
          )}
        </button>
        <input ref={fileRef} type="file" accept="image/*" capture="environment" onChange={handlePhotoChange} className="hidden" />
      </div>

      {/* Name */}
      <div>
        <label className={LABEL_CLS}>商品名</label>
        <input
          type="text"
          value={form.name}
          onChange={e => set('name', e.target.value)}
          placeholder="例: Leather Drivers JKT"
          className={INPUT_CLS}
          style={{ borderRadius: '2px' }}
        />
      </div>

      {/* Color */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <label className={LABEL_CLS + ' mb-0'}>カラー</label>
          <button type="button" onClick={() => setAddingColor(v => !v)} className="text-[10px] text-[#8B5E3C] font-medium tracking-wide">
            {addingColor ? 'キャンセル' : '+ 新しいカラー'}
          </button>
        </div>

        {addingColor && (
          <div className="flex items-center gap-2 mb-3 p-3 bg-[#F4EFE6] border border-[#DDD5C5]" style={{ borderRadius: '2px' }}>
            <input type="color" value={newColorHex} onChange={e => setNewColorHex(e.target.value)} className="w-9 h-9 cursor-pointer border border-[#DDD5C5] p-0.5 flex-shrink-0" style={{ borderRadius: '2px' }} />
            <input
              type="text"
              value={newColorName}
              onChange={e => setNewColorName(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), handleAddColor())}
              placeholder="カラー名"
              autoFocus
              className="flex-1 px-3 py-2 border border-[#DDD5C5] text-sm bg-[#FDFAF5] text-[#2C1A0E] focus:outline-none focus:border-[#8B5E3C] placeholder:text-[#C4B8A8]"
              style={{ borderRadius: '2px' }}
            />
            <button type="button" onClick={handleAddColor} className="px-3 py-2 bg-[#2C1A0E] text-[#F4EFE6] text-xs font-medium flex-shrink-0 tracking-wide" style={{ borderRadius: '2px' }}>追加</button>
          </div>
        )}

        <div className="flex flex-wrap gap-2">
          {colors.map(color => (
            <button
              key={color.id}
              type="button"
              onClick={() => set('colorId', color.id)}
              className={`flex items-center gap-1.5 pl-2 pr-3 py-1.5 text-[11px] font-medium transition-all border ${
                form.colorId === color.id
                  ? 'bg-[#2C1A0E] text-[#F4EFE6] border-[#2C1A0E]'
                  : 'bg-transparent text-[#7A6858] border-[#DDD5C5]'
              }`}
              style={{ borderRadius: '2px' }}
            >
              <span className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: color.hex }} />
              {color.name}
            </button>
          ))}
        </div>
      </div>

      {/* ── サイズ・在庫セクション ── */}
      {isEditing ? (
        /* 編集モード: 単一サイズ */
        <div className="space-y-3">
          <div>
            <label className={LABEL_CLS}>サイズ</label>
            <input
              type="text"
              value={form.size}
              onChange={e => set('size', e.target.value)}
              placeholder="例: M, L, XL, 34, FREE"
              className={INPUT_CLS}
              style={{ borderRadius: '2px' }}
            />
          </div>
          <div>
            <label className={LABEL_CLS}>在庫数</label>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <p className="text-[10px] text-[#A8998A] mb-1.5 text-center tracking-widest uppercase">店舗</p>
                <input type="number" min="0" value={form.storeStock} onChange={e => set('storeStock', e.target.value)} className={INPUT_CLS + ' text-center text-lg font-bold'} style={{ borderRadius: '2px' }} />
              </div>
              <div>
                <p className="text-[10px] text-[#A8998A] mb-1.5 text-center tracking-widest uppercase">501</p>
                <input type="number" min="0" value={form.stock501} onChange={e => set('stock501', e.target.value)} className={INPUT_CLS + ' text-center text-lg font-bold'} style={{ borderRadius: '2px' }} />
              </div>
            </div>
          </div>
        </div>
      ) : (
        /* 追加モード: 複数サイズ行 */
        <div>
          <div className="flex items-center justify-between mb-2">
            <label className={LABEL_CLS + ' mb-0'}>サイズ &amp; 在庫</label>
            <span className="text-[10px] text-[#A8998A]">{sizes.length} サイズ</span>
          </div>

          <div className="space-y-2">
            {sizes.map((row, i) => (
              <SizeRow
                key={row._key}
                row={row}
                index={i}
                onChange={updated => updateSize(row._key, updated)}
                onDelete={() => deleteSize(row._key)}
                canDelete={sizes.length > 1}
              />
            ))}
          </div>

          {/* サイズ追加ボタン */}
          <button
            type="button"
            onClick={addSizeRow}
            className="mt-2 w-full py-2.5 border border-dashed border-[#8B5E3C] text-[#8B5E3C] text-[11px] font-medium tracking-widest uppercase hover:bg-[#8B5E3C]/5 active:bg-[#8B5E3C]/10 transition-colors"
            style={{ borderRadius: '2px' }}
          >
            + サイズを追加
          </button>
        </div>
      )}

      {/* Dates */}
      <div>
        <label className={LABEL_CLS}>日付</label>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <p className="text-[10px] text-[#A8998A] mb-1.5 tracking-wide">入荷日</p>
            <input type="date" value={form.arrivalDate} onChange={e => set('arrivalDate', e.target.value)} className={INPUT_CLS} style={{ borderRadius: '2px' }} />
          </div>
          <div>
            <p className="text-[10px] text-[#A8998A] mb-1.5 tracking-wide">販売日</p>
            <input type="date" value={form.saleDate} onChange={e => set('saleDate', e.target.value)} className={INPUT_CLS} style={{ borderRadius: '2px' }} />
          </div>
        </div>
      </div>

      {/* Price */}
      <div>
        <label className={LABEL_CLS}>価格</label>
        <div className="relative">
          <span className="absolute left-4 top-1/2 -translate-y-1/2 text-[#A8998A] text-sm">¥</span>
          <input type="number" min="0" value={form.price} onChange={e => set('price', e.target.value)} placeholder="0" className={INPUT_CLS + ' pl-8'} style={{ borderRadius: '2px' }} />
        </div>
      </div>

      {/* Notes */}
      <div>
        <label className={LABEL_CLS}>メモ</label>
        <textarea value={form.notes} onChange={e => set('notes', e.target.value)} rows={3} placeholder="備考・状態など" className={INPUT_CLS + ' resize-none'} style={{ borderRadius: '2px' }} />
      </div>

      {/* Actions */}
      <div className="flex gap-3 pt-2">
        <button type="button" onClick={onCancel} className="flex-1 py-3.5 border border-[#DDD5C5] text-sm font-medium text-[#7A6858] tracking-wide active:bg-[#EDE7DA] transition-colors" style={{ borderRadius: '2px' }}>
          キャンセル
        </button>
        <button type="submit" className="flex-1 py-3.5 bg-[#2C1A0E] text-[#F4EFE6] text-sm font-medium tracking-widest active:bg-[#4a2e1a] transition-colors" style={{ borderRadius: '2px' }}>
          {isEditing ? '保存する' : `${sizes.length} 点を追加`}
        </button>
      </div>
    </form>
  )
}
