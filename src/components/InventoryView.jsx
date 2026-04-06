import { useState } from 'react'
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

  const usedColorIds = [...new Set(products.map(p => p.colorId))]
  const usedColors   = colors.filter(c => usedColorIds.includes(c.id))

  const filtered = (
    activeColor === 'all'
      ? products
      : products.filter(p => p.colorId === activeColor)
  ).slice().sort((a, b) => {
    const so = (a.sortOrder ?? 0) - (b.sortOrder ?? 0)
    if (so !== 0) return so
    const na = (a.name ?? '').localeCompare(b.name ?? '', 'ja', { numeric: true, sensitivity: 'base' })
    if (na !== 0) return na
    return (a.size ?? '').localeCompare(b.size ?? '', 'ja', { numeric: true, sensitivity: 'base' })
  })

  const storeTotal    = filtered.reduce((s, p) => s + (p.storeStock || 0), 0)
  const stock501Total = filtered.reduce((s, p) => s + (p.stock501  || 0), 0)

  // ── 並び替え ──────────────────────────────────────────────────────────────────
  const handleMove = (fromIdx, toIdx) => {
    if (toIdx < 0 || toIdx >= filtered.length) return
    // 移動後の配列を組み立てて 0,1,2... を振り直す
    const reordered = [...filtered]
    const [moved] = reordered.splice(fromIdx, 1)
    reordered.splice(toIdx, 0, moved)
    reordered.forEach((p, idx) => {
      if ((p.sortOrder ?? 0) !== idx) {
        onUpdateProduct(p.id, { sortOrder: idx })
      }
    })
  }

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
          size:        s.size,
          storeStock:  s.storeStock,
          stock501:    s.stock501,
          alert:       s.alert,
          arrivalDate: s.arrivalDate,
          saleDate:    s.saleDate,
          price:       s.price,
          notes:       s.notes,
          category,
        }
        if (s.id) {
          onUpdateProduct(s.id, productData)
        } else {
          onAddProduct(productData)
        }
      })
    } else {
      const { sizes, ...shared } = data
      sizes.forEach((sizeData, idx) => {
        onAddProduct({ ...shared, ...sizeData, category, sortOrder: idx })
      })
    }
    closeForm()
  }

  const handleDelete = (id) => {
    if (window.confirm('この商品を削除しますか？')) {
      onDeleteProduct(id)
    }
  }

  return (
    <div className="relative">
      <ColorTabs
        usedColors={usedColors}
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
        {/* 並び替えトグル */}
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
          <p className="text-[10px] text-[#8B5E3C] tracking-wide">↑↓ で順番を変更できます。変更は自動保存されます。</p>
        </div>
      )}

      {/* Product list */}
      <div className="p-3 space-y-2">
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
            <ProductCard
              key={product.id}
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

      {/* Product form modal */}
      {showForm && (
        <Modal
          onClose={closeForm}
          title={editingProduct ? '商品を編集' : '商品を追加'}
        >
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
