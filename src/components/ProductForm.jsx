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

const INPUT_CLS =
  'w-full px-4 py-3 rounded-xl border border-gray-200 text-sm bg-white focus:outline-none focus:border-[#C4956A] focus:ring-1 focus:ring-[#C4956A]/30'

export default function ProductForm({ product, category, colors, onSave, onCancel, onAddColor }) {
  const fileRef = useRef(null)
  const [form, setForm] = useState({
    name: product?.name ?? '',
    colorId: product?.colorId ?? (colors[0]?.id ?? ''),
    size: product?.size ?? '',
    storeStock: product?.storeStock ?? 0,
    stock501: product?.stock501 ?? 0,
    arrivalDate: product?.arrivalDate ?? '',
    saleDate: product?.saleDate ?? '',
    price: product?.price ?? '',
    notes: product?.notes ?? '',
    photo: product?.photo ?? null,
  })
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
    if (!exists) {
      onAddColor({ name, hex: newColorHex })
    }
    // Select the newly added or found color by name after it appears
    setNewColorName('')
    setNewColorHex('#888888')
    setAddingColor(false)
  }

  const handleSubmit = (e) => {
    e.preventDefault()
    onSave({
      ...form,
      storeStock: Math.max(0, Number(form.storeStock) || 0),
      stock501: Math.max(0, Number(form.stock501) || 0),
      price: form.price !== '' ? Number(form.price) : null,
    })
  }

  return (
    <form onSubmit={handleSubmit} className="px-5 pt-4 pb-8 space-y-5">
      {/* Category badge */}
      <div className="flex items-center justify-between">
        <h3 className="text-base font-bold text-[#1A1A1A]">
          {product ? '商品を編集' : '商品を追加'}
        </h3>
        <span className="text-xs bg-gray-100 text-gray-500 px-2.5 py-1 rounded-full font-medium">
          {category}
        </span>
      </div>

      {/* Photo */}
      <div>
        <label className="block text-xs font-semibold text-gray-500 mb-2 tracking-wide uppercase">写真</label>
        <button
          type="button"
          onClick={() => fileRef.current.click()}
          className="w-full h-44 rounded-2xl overflow-hidden border-2 border-dashed border-gray-200 bg-gray-50 flex items-center justify-center active:opacity-80 transition-opacity relative"
        >
          {photoLoading ? (
            <div className="text-gray-400 text-sm">読み込み中...</div>
          ) : form.photo ? (
            <>
              <img src={form.photo} alt="product" className="w-full h-full object-cover" />
              <div className="absolute inset-0 bg-black/20 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity">
                <span className="text-white text-sm font-medium bg-black/40 px-3 py-1 rounded-full">変更</span>
              </div>
            </>
          ) : (
            <div className="text-center text-gray-400">
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="mx-auto mb-2">
                <path d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z"/>
                <circle cx="12" cy="13" r="4"/>
              </svg>
              <p className="text-sm">タップして写真を追加</p>
              <p className="text-xs mt-0.5 text-gray-300">カメラまたはライブラリから</p>
            </div>
          )}
        </button>
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          capture="environment"
          onChange={handlePhotoChange}
          className="hidden"
        />
      </div>

      {/* Name */}
      <div>
        <label className="block text-xs font-semibold text-gray-500 mb-2 tracking-wide uppercase">商品名</label>
        <input
          type="text"
          value={form.name}
          onChange={e => set('name', e.target.value)}
          placeholder="例: Leather Jacket Type-A"
          className={INPUT_CLS}
        />
      </div>

      {/* Color */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <label className="text-xs font-semibold text-gray-500 tracking-wide uppercase">カラー</label>
          <button
            type="button"
            onClick={() => setAddingColor(v => !v)}
            className="text-xs text-[#C4956A] font-medium"
          >
            {addingColor ? 'キャンセル' : '+ 新しいカラー'}
          </button>
        </div>

        {addingColor && (
          <div className="flex items-center gap-2 mb-3 p-3 bg-gray-50 rounded-xl">
            <input
              type="color"
              value={newColorHex}
              onChange={e => setNewColorHex(e.target.value)}
              className="w-9 h-9 rounded-lg cursor-pointer border border-gray-200 p-0.5 flex-shrink-0"
            />
            <input
              type="text"
              value={newColorName}
              onChange={e => setNewColorName(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), handleAddColor())}
              placeholder="カラー名"
              autoFocus
              className="flex-1 px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none"
            />
            <button
              type="button"
              onClick={handleAddColor}
              className="px-3 py-2 bg-[#1A1A1A] text-white text-xs rounded-lg font-medium flex-shrink-0"
            >
              追加
            </button>
          </div>
        )}

        <div className="flex flex-wrap gap-2">
          {colors.map(color => (
            <button
              key={color.id}
              type="button"
              onClick={() => set('colorId', color.id)}
              className={`flex items-center gap-1.5 pl-2 pr-3 py-1.5 rounded-full text-[13px] font-medium transition-all ${
                form.colorId === color.id
                  ? 'bg-[#1A1A1A] text-white ring-2 ring-[#1A1A1A] ring-offset-1'
                  : 'bg-gray-100 text-gray-600'
              }`}
            >
              <span
                className="w-3.5 h-3.5 rounded-full flex-shrink-0 border border-white/50"
                style={{ backgroundColor: color.hex }}
              />
              {color.name}
            </button>
          ))}
        </div>
      </div>

      {/* Size */}
      <div>
        <label className="block text-xs font-semibold text-gray-500 mb-2 tracking-wide uppercase">サイズ</label>
        <input
          type="text"
          value={form.size}
          onChange={e => set('size', e.target.value)}
          placeholder="例: M, L, XL, 34, FREE"
          className={INPUT_CLS}
        />
      </div>

      {/* Stock */}
      <div>
        <label className="block text-xs font-semibold text-gray-500 mb-2 tracking-wide uppercase">在庫数</label>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <p className="text-xs text-gray-400 mb-1.5 text-center">店舗</p>
            <input
              type="number"
              min="0"
              value={form.storeStock}
              onChange={e => set('storeStock', e.target.value)}
              className={INPUT_CLS + ' text-center text-lg font-bold'}
            />
          </div>
          <div>
            <p className="text-xs text-gray-400 mb-1.5 text-center">501</p>
            <input
              type="number"
              min="0"
              value={form.stock501}
              onChange={e => set('stock501', e.target.value)}
              className={INPUT_CLS + ' text-center text-lg font-bold'}
            />
          </div>
        </div>
      </div>

      {/* Dates */}
      <div>
        <label className="block text-xs font-semibold text-gray-500 mb-2 tracking-wide uppercase">日付</label>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <p className="text-xs text-gray-400 mb-1.5">入荷日</p>
            <input
              type="date"
              value={form.arrivalDate}
              onChange={e => set('arrivalDate', e.target.value)}
              className={INPUT_CLS}
            />
          </div>
          <div>
            <p className="text-xs text-gray-400 mb-1.5">販売日</p>
            <input
              type="date"
              value={form.saleDate}
              onChange={e => set('saleDate', e.target.value)}
              className={INPUT_CLS}
            />
          </div>
        </div>
      </div>

      {/* Price */}
      <div>
        <label className="block text-xs font-semibold text-gray-500 mb-2 tracking-wide uppercase">価格</label>
        <div className="relative">
          <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 text-sm">¥</span>
          <input
            type="number"
            min="0"
            value={form.price}
            onChange={e => set('price', e.target.value)}
            placeholder="0"
            className={INPUT_CLS + ' pl-8'}
          />
        </div>
      </div>

      {/* Notes */}
      <div>
        <label className="block text-xs font-semibold text-gray-500 mb-2 tracking-wide uppercase">メモ</label>
        <textarea
          value={form.notes}
          onChange={e => set('notes', e.target.value)}
          rows={3}
          placeholder="備考・状態など"
          className={INPUT_CLS + ' resize-none'}
        />
      </div>

      {/* Actions */}
      <div className="flex gap-3 pt-2">
        <button
          type="button"
          onClick={onCancel}
          className="flex-1 py-3.5 rounded-2xl border border-gray-200 text-sm font-semibold text-gray-600 active:bg-gray-50"
        >
          キャンセル
        </button>
        <button
          type="submit"
          className="flex-1 py-3.5 rounded-2xl bg-[#1A1A1A] text-white text-sm font-semibold active:bg-gray-800"
        >
          保存する
        </button>
      </div>
    </form>
  )
}
