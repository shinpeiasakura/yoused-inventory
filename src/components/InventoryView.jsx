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
  onReorder,
}) {
  const [activeColor,    setActiveColor]    = useState('all')
  const [showForm,       setShowForm]       = useState(false)
  const [editingProduct, setEditingProduct] = useState(null)
  const [editingGroup,   setEditingGroup]   = useState([])
  const [reordering,     setReordering]     = useState(false)
  const [draggingIdx,    setDraggingIdx]    = useState(null)
  const [dropIdx,        setDropIdx]        = useState(null)

  const listRef      = useRef(null)
  const filteredRef  = useRef([])
  const pointerYRef  = useRef(0)
  const rafRef       = useRef(null)
  // dragState: 再レンダリングを起こさず最新状態を保持
  const dragState    = useRef({
    active:  false,
    fromIdx: null,
    overIdx: null,
    startX:  0,
    startY:  0,
    timer:   null,
  })

  // ── ソート: sort_order 降順（数値大 = 新しい・上に表示） ──────────────────────
  const filtered = (
    activeColor === 'all'
      ? products
      : products.filter(p => p.colorId === activeColor)
  ).slice().sort((a, b) => {
    const so = (b.sortOrder ?? 0) - (a.sortOrder ?? 0)
    if (so !== 0) return so
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
    // 変更が必要な商品だけ収集して一括送信
    const changes = []
    reordered.forEach((p, displayIdx) => {
      const newSortOrder = n - 1 - displayIdx
      if ((p.sortOrder ?? 0) !== newSortOrder) {
        changes.push({ id: p.id, sortOrder: newSortOrder })
      }
    })
    if (changes.length) onReorder(changes)
  }, [onReorder])

  // ── 自動スクロール（画面端に近づいたら自動スクロール）────────────────────────
  const stopAutoScroll = useCallback(() => {
    if (rafRef.current) { cancelAnimationFrame(rafRef.current); rafRef.current = null }
  }, [])

  const startAutoScroll = useCallback(() => {
    stopAutoScroll()
    const ZONE = 80
    const loop = () => {
      const y  = pointerYRef.current
      const vh = window.innerHeight
      if (y > 0 && y < ZONE) {
        window.scrollBy(0, -Math.ceil((ZONE - y) / 5))
      } else if (y > vh - ZONE && y < vh) {
        window.scrollBy(0, Math.ceil((y - (vh - ZONE)) / 5))
      }
      rafRef.current = requestAnimationFrame(loop)
    }
    rafRef.current = requestAnimationFrame(loop)
  }, [stopAutoScroll])

  // ── ドラッグ終了（ドロップ確定）────────────────────────────────────────────
  const endDrag = useCallback(() => {
    clearTimeout(dragState.current.timer)
    const { active, fromIdx, overIdx } = dragState.current
    dragState.current = { active: false, fromIdx: null, overIdx: null, startX: 0, startY: 0, timer: null }
    stopAutoScroll()
    setDraggingIdx(null)
    setDropIdx(null)
    if (active && fromIdx !== null && overIdx !== null && fromIdx !== overIdx) {
      navigator.vibrate?.([10, 20, 10])
      handleMove(fromIdx, overIdx)
    }
  }, [handleMove, stopAutoScroll])

  // ── ドキュメントレベルのポインターイベント & コンテキストメニュー抑制 ──────────
  useEffect(() => {
    if (!reordering) return

    const onPointerMove = (e) => {
      pointerYRef.current = e.clientY
      const ds = dragState.current

      if (!ds.active) {
        // 長押し中に指が動きすぎたらキャンセル（通常スクロールを許可）
        if (ds.fromIdx !== null) {
          const dx = Math.abs(e.clientX - ds.startX)
          const dy = Math.abs(e.clientY - ds.startY)
          if (dx > 6 || dy > 8) {
            clearTimeout(ds.timer)
            ds.fromIdx = null
          }
        }
        return
      }

      // ドラッグアクティブ中: ブラウザのスクロール・選択を抑制
      e.preventDefault()

      // ドロップ先インデックスを更新
      const cards = listRef.current?.querySelectorAll('[data-card-idx]')
      if (!cards) return
      let over = ds.fromIdx
      for (const card of cards) {
        const r = card.getBoundingClientRect()
        if (e.clientY < r.top + r.height / 2) { over = +card.dataset.cardIdx; break }
        over = +card.dataset.cardIdx
      }
      if (over !== ds.overIdx) {
        ds.overIdx = over
        setDropIdx(over)
      }
    }

    const preventCtx = (e) => e.preventDefault()

    document.addEventListener('pointermove',   onPointerMove, { passive: false })
    document.addEventListener('pointerup',     endDrag)
    document.addEventListener('pointercancel', endDrag)
    document.addEventListener('contextmenu',   preventCtx)

    return () => {
      document.removeEventListener('pointermove',   onPointerMove)
      document.removeEventListener('pointerup',     endDrag)
      document.removeEventListener('pointercancel', endDrag)
      document.removeEventListener('contextmenu',   preventCtx)
      stopAutoScroll()
    }
  }, [reordering, endDrag, stopAutoScroll])

  // ── カードの長押し開始（pointerdown） ────────────────────────────────────────
  const handleCardPointerDown = useCallback((e, idx) => {
    // マウスは左ボタンのみ対応
    if (e.pointerType === 'mouse' && e.button !== 0) return
    // ↑↓ボタン・編集ボタンなどのタップはドラッグを開始しない
    if (e.target.closest('button')) return

    const ds = dragState.current
    clearTimeout(ds.timer)
    ds.fromIdx = idx
    ds.overIdx = idx
    ds.startX  = e.clientX
    ds.startY  = e.clientY
    ds.active  = false

    ds.timer = setTimeout(() => {
      if (ds.fromIdx !== idx) return  // キャンセル済み
      navigator.vibrate?.(30)
      ds.active = true
      setDraggingIdx(idx)
      setDropIdx(idx)
      startAutoScroll()
    }, 180)
  }, [startAutoScroll])

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
        style={reordering ? {
          userSelect:         'none',
          WebkitUserSelect:   'none',
          WebkitTouchCallout: 'none',
        } : undefined}
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
          filtered.map((product, idx) => {
            const isLifted     = draggingIdx === idx
            const isDropTarget = reordering && dropIdx === idx && draggingIdx !== idx && draggingIdx !== idx - 1
            return (
              <div
                key={product.id}
                data-card-idx={idx}
                onPointerDown={reordering ? (e) => handleCardPointerDown(e, idx) : undefined}
                style={{
                  position:   'relative',
                  zIndex:     isLifted ? 20 : 1,
                  transform:  isLifted ? 'scale(1.03)' : 'scale(1)',
                  opacity:    isLifted ? 0.80 : 1,
                  boxShadow:  isLifted
                    ? '0 16px 40px rgba(44,26,14,0.32), 0 4px 12px rgba(44,26,14,0.20)'
                    : undefined,
                  // ドラッグ中はアニメーション不要、ドロップ直後はスムーズに収まる
                  transition: isLifted
                    ? 'none'
                    : 'transform 0.22s cubic-bezier(0.2,0,0,1), box-shadow 0.22s ease, opacity 0.18s ease',
                  // ドロップ先プレビュー: 上に太いラインと余白
                  borderTop:  isDropTarget ? '3px solid #8B5E3C' : '3px solid transparent',
                  paddingTop: isDropTarget ? '6px' : undefined,
                  // 並び替えモード中はタッチのデフォルト動作（スクロール・選択）を抑制
                  touchAction:        reordering ? 'none' : undefined,
                  WebkitUserSelect:   reordering ? 'none' : undefined,
                  WebkitTouchCallout: reordering ? 'none' : undefined,
                  cursor:             reordering ? (isLifted ? 'grabbing' : 'grab') : undefined,
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
            )
          })
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
