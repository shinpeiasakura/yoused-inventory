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
  const [activeColor, setActiveColor] = useState('all')
  const [showForm, setShowForm] = useState(false)
  const [editingProduct, setEditingProduct] = useState(null)

  // Colors that have at least one product in this category
  const usedColorIds = [...new Set(products.map(p => p.colorId))]
  const usedColors = colors.filter(c => usedColorIds.includes(c.id))

  const filtered =
    activeColor === 'all'
      ? products
      : products.filter(p => p.colorId === activeColor)

  const storeTotal = filtered.reduce((s, p) => s + (p.storeStock || 0), 0)
  const stock501Total = filtered.reduce((s, p) => s + (p.stock501 || 0), 0)

  const openAdd = () => {
    setEditingProduct(null)
    setShowForm(true)
  }

  const openEdit = (product) => {
    setEditingProduct(product)
    setShowForm(true)
  }

  const closeForm = () => {
    setShowForm(false)
    setEditingProduct(null)
  }

  const handleSave = (data) => {
    if (editingProduct) {
      onUpdateProduct(editingProduct.id, data)
    } else {
      onAddProduct({ ...data, category })
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
      {/* Color tabs */}
      <ColorTabs
        usedColors={usedColors}
        activeColor={activeColor}
        onChange={setActiveColor}
        allColors={colors}
        onAddColor={onAddColor}
      />

      {/* Stats bar */}
      <div className="px-4 py-2 bg-white border-b border-gray-100 flex items-center gap-4 text-xs text-gray-400">
        <span className="font-medium text-gray-600">{filtered.length} 件</span>
        <span>
          店舗 <span className="font-semibold text-gray-700">{storeTotal}</span>
        </span>
        <span>
          501 <span className="font-semibold text-gray-700">{stock501Total}</span>
        </span>
        <span>
          計 <span className="font-semibold text-[#C4956A]">{storeTotal + stock501Total}</span>
        </span>
      </div>

      {/* Product list */}
      <div className="p-3 space-y-2.5">
        {filtered.length === 0 ? (
          <div className="text-center py-20 text-gray-400">
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" className="mx-auto mb-3 text-gray-200">
              <path d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4"/>
            </svg>
            <p className="text-sm font-medium text-gray-400">商品がありません</p>
            <p className="text-xs text-gray-300 mt-1">右下の + ボタンで追加してください</p>
          </div>
        ) : (
          filtered.map(product => (
            <ProductCard
              key={product.id}
              product={product}
              color={colors.find(c => c.id === product.colorId)}
              onEdit={() => openEdit(product)}
              onDelete={() => handleDelete(product.id)}
              onUpdateStock={(field, value) => onUpdateProduct(product.id, { [field]: value })}
            />
          ))
        )}
      </div>

      {/* FAB */}
      <button
        onClick={openAdd}
        className="fixed right-4 fab-bottom z-30 w-14 h-14 rounded-full bg-[#1A1A1A] text-white shadow-xl flex items-center justify-center text-2xl active:scale-95 transition-transform"
        aria-label="商品を追加"
      >
        +
      </button>

      {/* Product form modal */}
      {showForm && (
        <Modal
          onClose={closeForm}
          title={editingProduct ? '商品を編集' : '商品を追加'}
        >
          <ProductForm
            product={editingProduct}
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
