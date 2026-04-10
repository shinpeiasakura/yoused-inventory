import { useState } from 'react'
import { ALERT_LEVELS, ALERT_CONFIG, calcAlert } from '../constants'

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

const LABEL_CLS = 'block text-[9px] font-semibold text-[#A8998A] mb-2 tracking-widest uppercase'
const INPUT_CLS =
  'w-full px-4 py-3 border border-[#DDD5C5] text-sm bg-[#FDFAF5] text-[#2C1A0E] focus:outline-none focus:border-[#8B5E3C] focus:ring-1 focus:ring-[#8B5E3C]/20 placeholder:text-[#C4B8A8] transition-colors'

// ── 在庫 +/− コントロール ──────────────────────────────────────────────────────
function InlineStock({ label, value, onChange }) {
  return (
    <div className="flex flex-col items-center gap-1">
      <span className="text-[9px] text-[#A8998A] tracking-widest uppercase">{label}</span>
      <div className="flex items-center gap-1.5">
        <button type="button" onClick={() => onChange(Math.max(0, value - 1))}
          className="w-7 h-7 flex items-center justify-center text-[#7A6858] text-base leading-none bg-[#EDE7DA] active:bg-[#DDD5C5]" style={{ borderRadius: '2px' }}>−</button>
        <span className="w-6 text-center text-sm font-bold text-[#2C1A0E] tabular-nums select-none">{value}</span>
        <button type="button" onClick={() => onChange(value + 1)}
          className="w-7 h-7 flex items-center justify-center text-[#F4EFE6] text-base leading-none bg-[#2C1A0E] active:bg-[#4a2e1a]" style={{ borderRadius: '2px' }}>+</button>
      </div>
    </div>
  )
}

// ── アラートセレクター ─────────────────────────────────────────────────────────
function AlertSelector({ value, onChange }) {
  return (
    <div className="flex gap-1.5 flex-wrap">
      {ALERT_LEVELS.map(level => (
        <button
          key={level.value}
          type="button"
          onClick={() => onChange(level.value)}
          className="flex items-center gap-1 px-2 py-1 text-[10px] font-medium border transition-all"
          style={{
            borderRadius: '2px',
            backgroundColor: value === level.value ? level.bg : 'transparent',
            color:           value === level.value ? level.text : '#A8998A',
            borderColor:     value === level.value ? level.dot  : '#DDD5C5',
          }}
        >
          <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ backgroundColor: value === level.value ? level.dot : '#C4B8A8' }} />
          {level.label}
        </button>
      ))}
    </div>
  )
}

// ── 1サイズ行 ─────────────────────────────────────────────────────────────────
function SizeRow({ row, onChange, onDelete, canDelete }) {
  const [expanded, setExpanded] = useState(false)

  const updateStock = (field, v) => {
    const next = { ...row, [field]: v }
    // 手動オーバーライドしていなければアラートを自動更新
    if (!next._alertManual) {
      next.alert = calcAlert(next.storeStock, next.stock501)
    }
    onChange(next)
  }

  const updateAlert = (val) => {
    onChange({ ...row, alert: val, _alertManual: true })
  }

  const alertCfg = ALERT_CONFIG[row.alert] ?? ALERT_CONFIG['ok']

  return (
    <div className="bg-[#F4EFE6] border border-[#DDD5C5]" style={{ borderRadius: '2px' }}>
      {/* メイン行 */}
      <div className="p-3 flex items-center gap-3">
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

        {/* 在庫 */}
        <div className="flex flex-1 justify-around gap-2">
          <InlineStock label="店舗" value={row.storeStock} onChange={v => updateStock('storeStock', v)} />
          <InlineStock label="501"  value={row.stock501}   onChange={v => updateStock('stock501',   v)} />
        </div>

        {/* 詳細展開ボタン */}
        <button
          type="button"
          onClick={() => setExpanded(v => !v)}
          className="flex-shrink-0 w-7 h-7 flex items-center justify-center text-[#A8998A] transition-transform"
          style={{ transform: expanded ? 'rotate(180deg)' : 'rotate(0deg)' }}
          aria-label="詳細を展開"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <polyline points="6 9 12 15 18 9"/>
          </svg>
        </button>

        {/* 削除ボタン */}
        <button
          type="button"
          onClick={onDelete}
          disabled={!canDelete}
          className={`flex-shrink-0 w-7 h-7 flex items-center justify-center text-lg transition-colors ${
            canDelete ? 'text-[#C4B8A8] hover:text-red-400 active:text-red-500' : 'text-[#EDE7DA] cursor-default'
          }`}
          aria-label="このサイズを削除"
        >×</button>
      </div>

      {/* アラートバッジ（常時表示） */}
      <div className="px-3 pb-2 flex items-center gap-2">
        <span className="text-[9px] text-[#A8998A] tracking-widest uppercase flex-shrink-0">ALERT</span>
        <AlertSelector value={row.alert} onChange={updateAlert} />
      </div>

      {/* 詳細展開パネル（入荷日・販売日・価格・メモ） */}
      {expanded && (
        <div className="border-t border-[#DDD5C5] p-3 space-y-3 bg-[#FDFAF5]">
          <div className="grid grid-cols-2 gap-2">
            <div>
              <p className="text-[9px] text-[#A8998A] mb-1 tracking-widest uppercase">入荷日</p>
              <div className="flex gap-1">
                <input
                  type="date"
                  value={row.arrivalDate || ''}
                  onChange={e => onChange({ ...row, arrivalDate: e.target.value })}
                  className="flex-1 min-w-0 px-2 py-2 border border-[#DDD5C5] text-xs bg-[#FDFAF5] text-[#2C1A0E] focus:outline-none focus:border-[#8B5E3C]"
                  style={{ borderRadius: '2px' }}
                />
                {row.arrivalDate && (
                  <button type="button" onClick={() => onChange({ ...row, arrivalDate: '' })}
                    className="flex-shrink-0 w-7 h-7 flex items-center justify-center text-[#C4B8A8] hover:text-[#7A6858] text-base"
                    style={{ borderRadius: '2px' }} aria-label="入荷日をクリア">×</button>
                )}
              </div>
            </div>
            <div>
              <p className="text-[9px] text-[#A8998A] mb-1 tracking-widest uppercase">販売日</p>
              <div className="flex gap-1">
                <input
                  type="date"
                  value={row.saleDate || ''}
                  onChange={e => onChange({ ...row, saleDate: e.target.value })}
                  className="flex-1 min-w-0 px-2 py-2 border border-[#DDD5C5] text-xs bg-[#FDFAF5] text-[#2C1A0E] focus:outline-none focus:border-[#8B5E3C]"
                  style={{ borderRadius: '2px' }}
                />
                {row.saleDate && (
                  <button type="button" onClick={() => onChange({ ...row, saleDate: '' })}
                    className="flex-shrink-0 w-7 h-7 flex items-center justify-center text-[#C4B8A8] hover:text-[#7A6858] text-base"
                    style={{ borderRadius: '2px' }} aria-label="販売日をクリア">×</button>
                )}
              </div>
            </div>
          </div>
          <div>
            <p className="text-[9px] text-[#A8998A] mb-1 tracking-widest uppercase">価格</p>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[#A8998A] text-sm">¥</span>
              <input
                type="number"
                min="0"
                value={row.price ?? ''}
                onChange={e => onChange({ ...row, price: e.target.value === '' ? null : e.target.value })}
                placeholder="0"
                className="w-full pl-7 pr-3 py-2 border border-[#DDD5C5] text-sm bg-[#FDFAF5] text-[#2C1A0E] focus:outline-none focus:border-[#8B5E3C] placeholder:text-[#C4B8A8]"
                style={{ borderRadius: '2px' }}
              />
            </div>
          </div>
          <div>
            <p className="text-[9px] text-[#A8998A] mb-1 tracking-widest uppercase">メモ</p>
            <textarea
              value={row.notes}
              onChange={e => onChange({ ...row, notes: e.target.value })}
              rows={2}
              placeholder="備考・状態など"
              className="w-full px-3 py-2 border border-[#DDD5C5] text-sm bg-[#FDFAF5] text-[#2C1A0E] focus:outline-none focus:border-[#8B5E3C] placeholder:text-[#C4B8A8] resize-none"
              style={{ borderRadius: '2px' }}
            />
          </div>
        </div>
      )}
    </div>
  )
}

// ── メインフォーム ─────────────────────────────────────────────────────────────
/**
 * @param product      - 編集対象商品（追加時は null）
 * @param groupProducts - 同一商品の全サイズ（編集時のみ使用）
 */
export default function ProductForm({ product, groupProducts = [], category, colors, onSave, onCancel, onAddColor }) {
  const isEditing = !!product

  // ── 共通フィールド ────────────────────────────────────────────────────────
  const [form, setForm] = useState({
    name:    product?.name    ?? '',
    colorId: product?.colorId ?? (colors[0]?.id ?? ''),
    photo:   product?.photo   ?? null,   // 追加モードのみ使用
  })

  // ── サイズ行（追加 & 編集 共通）──────────────────────────────────────────
  const [sizeRows, setSizeRows] = useState(() => {
    if (isEditing && groupProducts.length > 0) {
      return groupProducts.map(p => ({
        _key:         p.id,
        id:           p.id,
        size:         p.size,
        storeStock:   p.storeStock,
        stock501:     p.stock501,
        alert:        p.alert ?? calcAlert(p.storeStock, p.stock501),
        _alertManual: p.alert != null,
        arrivalDate:  p.arrivalDate ?? '',
        saleDate:     p.saleDate    ?? '',
        price:        p.price       ?? null,
        notes:        p.notes       ?? '',
      }))
    }
    return [{
      _key: crypto.randomUUID(),
      size: '', storeStock: 0, stock501: 0,
      alert: 'ok', _alertManual: false,
      arrivalDate: '', saleDate: '', price: null, notes: '',
    }]
  })
  const [deletedIds, setDeletedIds] = useState([])

  // ── カラー追加 ────────────────────────────────────────────────────────────
  const [addingColor, setAddingColor] = useState(false)
  const [newColorName, setNewColorName] = useState('')
  const [newColorHex, setNewColorHex] = useState('#888888')

  // ── 写真（追加モードのみ） ────────────────────────────────────────────────
  const [photoLoading, setPhotoLoading] = useState(false)

  const set = (key, value) => setForm(f => ({ ...f, [key]: value }))

  const handlePhotoChange = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    e.target.value = ''
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
    setNewColorName(''); setNewColorHex('#888888'); setAddingColor(false)
  }

  // ── サイズ行操作 ──────────────────────────────────────────────────────────
  const updateSizeRow = (_key, updated) =>
    setSizeRows(prev => prev.map(r => r._key === _key ? { ...r, ...updated } : r))

  const deleteSizeRow = (_key, id) => {
    setSizeRows(prev => prev.filter(r => r._key !== _key))
    if (id) setDeletedIds(prev => [...prev, id])
  }

  const addSizeRow = () =>
    setSizeRows(prev => [...prev, {
      _key: crypto.randomUUID(),
      size: '', storeStock: 0, stock501: 0,
      alert: 'ok', _alertManual: false,
      arrivalDate: '', saleDate: '', price: null, notes: '',
    }])

  // ── 送信 ──────────────────────────────────────────────────────────────────
  const handleSubmit = (e) => {
    e.preventDefault()

    const mappedRows = sizeRows.map(r => ({
      id:          r.id,
      size:        r.size,
      storeStock:  Math.max(0, r.storeStock),
      stock501:    Math.max(0, r.stock501),
      alert:       r.alert,
      arrivalDate: r.arrivalDate,
      saleDate:    r.saleDate,
      price:       r.price !== '' && r.price != null ? Number(r.price) : null,
      notes:       r.notes,
    }))

    const shared = { name: form.name, colorId: form.colorId }

    if (isEditing) {
      onSave({ _isGroupEdit: true, shared, sizeRows: mappedRows, deletedIds })
    } else {
      onSave({ ...shared, photo: form.photo, sizes: mappedRows })
    }
  }

  // ── レンダリング ──────────────────────────────────────────────────────────
  return (
    <form onSubmit={handleSubmit} className="px-5 pt-4 pb-8 space-y-5">

      {/* Category badge */}
      <div className="flex items-center justify-between">
        <p className="text-[9px] text-[#A8998A] tracking-widest uppercase font-medium">Category</p>
        <span className="text-[10px] bg-[#EDE7DA] text-[#7A6858] px-2.5 py-1 tracking-widest uppercase font-medium" style={{ borderRadius: '2px' }}>
          {category}
        </span>
      </div>

      {/* 写真（追加モードのみ表示 — 編集時はカードのカメラアイコンから変更） */}
      {!isEditing && (
        <div>
          <p className={LABEL_CLS}>写真</p>
          <label
            className="w-full h-44 overflow-hidden border border-dashed border-[#DDD5C5] bg-[#F4EFE6] flex items-center justify-center active:opacity-80 transition-opacity"
            style={{ borderRadius: '2px', position: 'relative', cursor: 'pointer', display: 'flex' }}
          >
            {photoLoading ? (
              <div className="text-[#A8998A] text-sm tracking-wide">読み込み中...</div>
            ) : form.photo ? (
              <>
                <img src={form.photo} alt="product" className="w-full h-full object-cover" style={{ position: 'absolute', inset: 0 }} />
                <div className="absolute inset-0 bg-[#2C1A0E]/20 flex items-center justify-center">
                  <span className="text-[#F4EFE6] text-xs font-medium bg-[#2C1A0E]/60 px-3 py-1 tracking-widest uppercase" style={{ borderRadius: '1px' }}>変更</span>
                </div>
              </>
            ) : (
              <div className="text-center text-[#C4B8A8] pointer-events-none">
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2" className="mx-auto mb-2">
                  <path d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z"/>
                  <circle cx="12" cy="13" r="4"/>
                </svg>
                <p className="text-xs tracking-wide">タップして写真を追加</p>
                <p className="text-[10px] mt-0.5 text-[#D4C9B8] tracking-wide">カメラまたはライブラリ</p>
              </div>
            )}
            <input
              type="file"
              accept="image/*"
              onChange={handlePhotoChange}
              style={{ position: 'absolute', inset: 0, opacity: 0, width: '100%', height: '100%', cursor: 'pointer', fontSize: 0 }}
            />
          </label>
        </div>
      )}

      {/* 編集時: 写真の変更案内 */}
      {isEditing && (
        <p className="text-[10px] text-[#A8998A] tracking-wide text-center py-1">
          写真はカードの 📷 アイコンから変更できます
        </p>
      )}

      {/* 商品名 */}
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

      {/* カラー */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <label className={LABEL_CLS + ' mb-0'}>カラー</label>
          <button type="button" onClick={() => setAddingColor(v => !v)} className="text-[10px] text-[#8B5E3C] font-medium tracking-wide">
            {addingColor ? 'キャンセル' : '+ 新しいカラー'}
          </button>
        </div>
        {addingColor && (
          <div className="flex items-center gap-2 mb-3 p-3 bg-[#F4EFE6] border border-[#DDD5C5]" style={{ borderRadius: '2px' }}>
            <input type="color" value={newColorHex} onChange={e => setNewColorHex(e.target.value)}
              className="w-9 h-9 cursor-pointer border border-[#DDD5C5] p-0.5 flex-shrink-0" style={{ borderRadius: '2px' }} />
            <input
              type="text" value={newColorName} onChange={e => setNewColorName(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), handleAddColor())}
              placeholder="カラー名" autoFocus
              className="flex-1 px-3 py-2 border border-[#DDD5C5] text-sm bg-[#FDFAF5] text-[#2C1A0E] focus:outline-none focus:border-[#8B5E3C] placeholder:text-[#C4B8A8]"
              style={{ borderRadius: '2px' }}
            />
            <button type="button" onClick={handleAddColor}
              className="px-3 py-2 bg-[#2C1A0E] text-[#F4EFE6] text-xs font-medium flex-shrink-0 tracking-wide" style={{ borderRadius: '2px' }}>追加</button>
          </div>
        )}
        <div className="flex flex-wrap gap-2">
          {colors.map(color => (
            <button key={color.id} type="button" onClick={() => set('colorId', color.id)}
              className={`flex items-center gap-1.5 pl-2 pr-3 py-1.5 text-[11px] font-medium transition-all border ${
                form.colorId === color.id ? 'bg-[#2C1A0E] text-[#F4EFE6] border-[#2C1A0E]' : 'bg-transparent text-[#7A6858] border-[#DDD5C5]'
              }`}
              style={{ borderRadius: '2px' }}
            >
              <span className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: color.hex }} />
              {color.name}
            </button>
          ))}
        </div>
      </div>

      {/* ── サイズ & 在庫 ──────────────────────────────────────────────────── */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <label className={LABEL_CLS + ' mb-0'}>
            {isEditing ? 'サイズ一覧' : 'サイズ & 在庫'}
          </label>
          <span className="text-[10px] text-[#A8998A]">{sizeRows.length} サイズ</span>
        </div>

        <div className="space-y-2">
          {sizeRows.map(row => (
            <SizeRow
              key={row._key}
              row={row}
              onChange={updated => updateSizeRow(row._key, updated)}
              onDelete={() => deleteSizeRow(row._key, row.id)}
              canDelete={sizeRows.length > 1}
            />
          ))}
        </div>

        <button
          type="button"
          onClick={addSizeRow}
          className="mt-2 w-full py-2.5 border border-dashed border-[#8B5E3C] text-[#8B5E3C] text-[11px] font-medium tracking-widest uppercase hover:bg-[#8B5E3C]/5 active:bg-[#8B5E3C]/10 transition-colors"
          style={{ borderRadius: '2px' }}
        >
          + サイズを追加
        </button>
      </div>

      {/* ボタン */}
      <div className="flex gap-3 pt-2">
        <button type="button" onClick={onCancel}
          className="flex-1 py-3.5 border border-[#DDD5C5] text-sm font-medium text-[#7A6858] tracking-wide active:bg-[#EDE7DA] transition-colors" style={{ borderRadius: '2px' }}>
          キャンセル
        </button>
        <button type="submit"
          className="flex-1 py-3.5 bg-[#2C1A0E] text-[#F4EFE6] text-sm font-medium tracking-widest active:bg-[#4a2e1a] transition-colors" style={{ borderRadius: '2px' }}>
          {isEditing ? '保存する' : `${sizeRows.length} 点を追加`}
        </button>
      </div>
    </form>
  )
}
