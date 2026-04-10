import { useState, useRef, useEffect, useCallback } from 'react'
import ColorTabs from './ColorTabs'
import ProductCard from './ProductCard'
import ProductForm from './ProductForm'
import Modal from './Modal'

export default function InventoryView({
  category,
  products,
  colors,
  onAddProduct,
  onUpdateProduct,
  onDeleteProduct,
  onAddColor,
}) {
  const [activeColor,    setActiveColor]    = useState('all')
  const [showForm,       setShowForm]       = useState(false)
  const [editingProduct, setEditingProduct] = useState(null)
  const [editingGroup,   setEditingGroup]   = useState([])
  const [reordering,     setReordering]     = useState(false)
  const [draggingIdx,    setDraggingIdx]    = useState(null)
  const [dropIdx,        setDropIdx]        = useState(null)

  const listRef   = useRef(null)
  // dragInfo は再レンダリングを起こさず最新状態を保持するためrefで管理
  const dragInfo  = useRef({ pressing: false, active: false, fromIdx: null, overIdx: null, timer: null })
  const filteredRef = useRef([])

  // ── ソート: sort_order 降順（数値大 = 新しい・上に表示） ──────────────────────
  const filtered = (
    activeColor === 'all'
      ? products
      : products.filter(p => p.colorId === activeColor)
  ).slice().sort((a, b) => {
    // sort_order 降順（新しく追加したものが上）
    const so = (b.sortOrder ?? 0) - (a.sortOrder ?? 0)
    if (so !== 0) return so
    // 同値の場合は name → size で安定ソート
    const na = (a.name ?? '').localeCompare(b.name ?? '', 'ja', { numeric: true, sensitivity: 'base' })
    if (na !== 0) return na
    return (a.size ?? '').localeCompare(b.size ?? '', 'ja', { numeric: true, sensitivity: 'base' })
  })

  filteredRef.current = filtered

  const storeTotal    = filtered.reduce((s, p) => s + (p.storeStock || 0), 0)
  const stock501Total = filtered.reduce((s, p) => s + (p.stock501  || 0), 0)

  // ── 並び替えハンドラ（DESC前提: 先頭=最大値） ──────────────────────────────
  const handleMove = useCallback((fromIdx, toIdx) => {
    const current = filteredRef.current
    if (toIdx < 0 || toIdx >= current.length) return
    const reordered = [...current]
    const [moved] = reordered.splice(fromIdx, 1)
    reordered.splice(toIdx, 0, moved)
    const n = reordered.length
    reordered.forEach((p, displayIdx) => {
      // 先頭(displayIdx=0)が最大値になるよう降順で割り当て
      const newSortOrder = n - 1 - displayIdx
      if ((p.sortOrder ?? 0) !== newSortOrder) {
        onUpdateProduct(p.id, { sortOrder: newSortOrder })
      }
    })
  }, [onUpdateProduct])

  // ── ドラッグ&ドロップ: 非パッシブtouchmoveリスナー ───────────────────────────
  useEffect(() => {
    const el = listRef.current
    if (!el || !reordering) return

    const onMove = (e) => {
      if (!dragInfo.current.active) return
      e.preventDefault()
      const y = e.touches[0].clientY
      const cards = el.querySelectorAll('[data-card-idx]')
      let over = dragInfo.current.fromIdx
      for (const card of cards) {
        const r = card.getBoundingClientRect()
        if (y < r.top + r.height / 2) { over = +card.dataset.cardIdx; break }
        over = +card.dataset.cardIdx
      }
      if (over !== dragInfo.current.overIdx) {
        dragInfo.current.overIdx = over
        setDropIdx(over)
      }
    }
    el.addEventListener('touchmove', onMove, { passive: false })
    return () => el.removeEventListener('touchmove', onMove)
  }, [reordering])

  const handleListTouchStart = (e) => {
    const cardEl = e.target.closest('[data-card-idx]')
    if (!cardEl) return
    const idx = +cardEl.dataset.cardIdx
    dragInfo.current.pressing = true
    dragInfo.current.fromIdx  = idx
    dragInfo.current.overIdx  = idx
    dragInfo.current.timer = setTimeout(() => {
      if (!dragInfo.current.pressing) return
      navigator.vibrate?.(30)
      dragInfo.current.active = true
      setDraggingIdx(idx)
      setDropIdx(idx)
    }, 400)
  }

  const handleListTouchEnd = useCallback(() => {
    clearTimeout(dragInfo.current.timer)
    const { active, fromIdx, overIdx } = dragInfo.current
    dragInfo.current = { pressing: false, active: false, fromIdx: null, overIdx: null, timer: null }
    setDraggingIdx(null)
    setDropIdx(null)
    if (active && fromIdx !== null && overIdx !== null && fromIdx !== overIdx) {
      handleMove(fromIdx, overIdx)
    }
  }, [handleMove])

  const handleListTouchCancel = () => {
    clearTimeout(dragInfo.current.timer)
    dragInfo.current = { pressing: false, active: false, fromIdx: null, overIdx: null, timer: null }
    setDraggingIdx(null)
    setDropIdx(null)
  }

  // ── フォーム操作 ─────────────────────────────────────────────────────────────
  const openAdd = () => {
    setEditingProduct(null)
    setEditingGroup([])
    setShowForm(true)
  }

  const openEdit = (product) => {
    const group = products.filter(
      p => p.name === product.name && p.colorId === product.colorId
    )
    setEditingProduct(product)
    setEditingGroup(group)
    setShowForm(true)
  }

  const closeForm = () => {
    setShowForm(false)
    setEditingProduct(null)
    setEditingGroup([])
  }

  const handleSave = (data) => {
    if (editingProduct) {
      const { shared, sizeRows, deletedIds } = data
      deletedIds.forEach(id => onDeleteProduct(id))
      sizeRows.forEach(s => {
        const productData = {
          ...shared,
          size: s.size, storeStock: s.storeStock, stock501: s.stock501,
          alert: s.alert, arrivalDate: s.arrivalDate, saleDate: s.saleDate,
          price: s.price, notes: s.notes, category,
        }
        if (s.id) onUpdateProduct(s.id, productData)
        else       onAddProduct(productData)
      })
    } else {
      const { sizes, ...shared } = data
      // 現在の最大 sort_order を取得し、新商品は最大値+n から +1 ずつ割り当て
      // DESC ソートなので最大値が上に来る → 新商品が一番上に表示される
      const maxSO = products.reduce((m, p) => Math.max(m, p.sortOrder ?? 0), 0)
      const base  = maxSO + sizes.length
      sizes.forEach((sizeData, idx) => {
        onAddProduct({ ...shared, ...sizeData, category, sortOrder: base - idx })
      })
    }
    closeForm()
  }

  const handleDelete = (id) => {
    if (window.confirm('この商品を削除しますか？')) {
      onDeleteProduct(id)
    }
  }

  const isDragging = draggingIdx !== null

  return (
    <div className="relative">
      <ColorTabs
        usedColors={colors.filter(c => [...new Set(products.map(p => p.colorId))].includes(c.id))}
        activeColor={activeColor}
        onChange={(c) => { setActiveColor(c); setReordering(false) }}
        allColors={colors}
        onAddColor={onAddColor}
      />

      {/* Stats bar */}
      <div className="px-4 py-2.5 bg-[#FDFAF5] border-b border-[#DDD5C5] flex items-center gap-4">
        <span className="text-[11px] font-semibold text-[#2C1A0E] tracking-wide">{filtered.length} 点</span>
        <span className="text-[11px] text-[#A8998A]">
          店舗 <span className="font-semibold text-[#2C1A0E]">{storeTotal}</span>
        </span>
        <span className="text-[11px] text-[#A8998A]">
          501 <span className="font-semibold text-[#2C1A0E]">{stock501Total}</span>
        </span>
        <span className="text-[11px] text-[#A8998A]">
          計 <span className="font-semibold text-[#8B5E3C]">{storeTotal + stock501Total}</span>
        </span>
        {filtered.length > 1 && (
          <button
            onClick={() => setReordering(v => !v)}
            className={`ml-auto text-[10px] font-medium tracking-widest px-2.5 py-1 border transition-colors ${
              reordering
                ? 'bg-[#2C1A0E] text-[#F4EFE6] border-[#2C1A0E]'
                : 'text-[#A8998A] border-[#DDD5C5] active:bg-[#EDE7DA]'
            }`}
            style={{ borderRadius: '2px' }}
          >
            {reordering ? '完了' : '並替'}
          </button>
        )}
      </div>

      {/* 並び替えモード案内 */}
      {reordering && (
        <div className="px-4 py-2 bg-[#F4EFE6] border-b border-[#DDD5C5] flex items-center gap-2">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-[#8B5E3C] flex-shrink-0">
            <line x1="3" y1="6"  x2="21" y2="6"/>
            <line x1="3" y1="12" x2="21" y2="12"/>
            <line x1="3" y1="18" x2="21" y2="18"/>
          </svg>
          <p className="text-[10px] text-[#8B5E3C] tracking-wide">
            {isDragging ? 'ドラッグ中...' : '長押しでドラッグ、または ↑↓ で移動。変更は自動保存。'}
          </p>
        </div>
      )}

      {/* Product list */}
      <div
        ref={listRef}
        className="p-3 space-y-2"
        onTouchStart={reordering ? handleListTouchStart : undefined}
        onTouchEnd={reordering ? handleListTouchEnd : undefined}
        onTouchCancel={reordering ? handleListTouchCancel : undefined}
      >
        {filtered.length === 0 ? (
          <div className="text-center py-20">
            <svg width="44" height="44" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="0.8" className="mx-auto mb-4 text-[#C4B8A8]">
              <path d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4"/>
            </svg>
            <p className="font-serif text-sm text-[#A8998A] mb-1">商品がありません</p>
            <p className="text-[11px] text-[#C4B8A8] tracking-wide">右下の ＋ から追加してください</p>
          </div>
        ) : (
          filtered.map((product, idx) => (
            <div
              key={product.id}
              data-card-idx={idx}
              style={{
                opacity:    draggingIdx === idx ? 0.35 : 1,
                transition: 'opacity 0.15s',
                // ドロップ先の上に仕切り線を表示（ドラッグ元の前後は除外）
                borderTop: (
                  reordering &&
                  dropIdx === idx &&
                  draggingIdx !== idx &&
                  draggingIdx !== idx - 1
                ) ? '2px solid #8B5E3C' : '2px solid transparent',
              }}
            >
              <ProductCard
                product={product}
                color={colors.find(c => c.id === product.colorId)}
                onEdit={() => openEdit(product)}
                onDelete={() => handleDelete(product.id)}
                onUpdateStock={(field, value) => onUpdateProduct(product.id, { [field]: value })}
                onUpdatePhoto={(photo) => onUpdateProduct(product.id, { photo })}
                isReordering={reordering}
                isFirst={idx === 0}
                isLast={idx === filtered.length - 1}
                onMoveUp={() => handleMove(idx, idx - 1)}
                onMoveDown={() => handleMove(idx, idx + 1)}
              />
            </div>
          ))
        )}
      </div>

      {/* FAB — 並び替え中は非表示 */}
      {!reordering && (
        <button
          onClick={openAdd}
          className="fixed right-4 fab-bottom z-30 w-14 h-14 bg-[#2C1A0E] text-[#F4EFE6] shadow-lg flex items-center justify-center text-2xl active:scale-95 transition-transform"
          style={{ borderRadius: '3px' }}
          aria-label="商品を追加"
        >
          +
        </button>
      )}

      {showForm && (
        <Modal onClose={closeForm} title={editingProduct ? '商品を編集' : '商品を追加'}>
          <ProductForm
            product={editingProduct}
            groupProducts={editingGroup}
            category={category}
            colors={colors}
            onSave={handleSave}
            onCancel={closeForm}
            onAddColor={onAddColor}
          />
        </Modal>
      )}
    </div>
  )
}
