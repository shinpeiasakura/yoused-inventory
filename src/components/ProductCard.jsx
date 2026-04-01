import { useState } from 'react'

function StockControl({ label, value, onChange }) {
  return (
    <div className="flex flex-col items-center gap-1">
      <span className="text-[10px] text-gray-400 font-medium tracking-wide">{label}</span>
      <div className="flex items-center gap-2">
        <button
          onClick={() => onChange(Math.max(0, value - 1))}
          className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center text-gray-600 text-xl leading-none active:bg-gray-200 transition-colors"
          aria-label={`${label}を減らす`}
        >
          −
        </button>
        <span className="w-7 text-center text-base font-bold text-[#1A1A1A] tabular-nums">{value}</span>
        <button
          onClick={() => onChange(value + 1)}
          className="w-8 h-8 rounded-full bg-[#1A1A1A] flex items-center justify-center text-white text-xl leading-none active:bg-gray-700 transition-colors"
          aria-label={`${label}を増やす`}
        >
          +
        </button>
      </div>
    </div>
  )
}

export default function ProductCard({ product, color, onEdit, onDelete, onUpdateStock }) {
  const [expanded, setExpanded] = useState(false)

  const totalStock = (product.storeStock || 0) + (product.stock501 || 0)

  return (
    <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
      <div className="flex gap-0">
        {/* Photo */}
        <button
          onClick={() => setExpanded(v => !v)}
          className="relative w-[88px] flex-shrink-0"
        >
          {product.photo ? (
            <img
              src={product.photo}
              alt={product.name}
              className="w-full h-full object-cover"
              style={{ minHeight: '88px' }}
            />
          ) : (
            <div className="w-full bg-gray-50 flex flex-col items-center justify-center text-gray-300 gap-1" style={{ minHeight: '88px' }}>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <path d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z"/>
                <circle cx="12" cy="13" r="4"/>
              </svg>
              <span className="text-[9px]">写真</span>
            </div>
          )}
          {/* Stock badge */}
          <div className={`absolute top-1.5 right-1.5 min-w-[20px] h-5 px-1 rounded-full flex items-center justify-center text-[10px] font-bold ${
            totalStock === 0 ? 'bg-red-500 text-white' : 'bg-[#1A1A1A] text-white'
          }`}>
            {totalStock}
          </div>
        </button>

        {/* Content */}
        <div className="flex-1 px-3 py-3 min-w-0">
          {/* Name & actions */}
          <div className="flex items-start justify-between gap-1 mb-1.5">
            <div className="min-w-0">
              <h3 className="font-semibold text-[#1A1A1A] text-sm leading-tight truncate">
                {product.name || '名称未設定'}
              </h3>
              <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                {color && (
                  <span className="flex items-center gap-1 text-[11px] text-gray-500">
                    <span
                      className="w-2.5 h-2.5 rounded-full flex-shrink-0 border border-gray-200"
                      style={{ backgroundColor: color.hex }}
                    />
                    {color.name}
                  </span>
                )}
                {product.size && (
                  <span className="text-[11px] text-gray-500 bg-gray-100 px-1.5 py-0.5 rounded-md font-medium">
                    {product.size}
                  </span>
                )}
                {product.price ? (
                  <span className="text-[11px] text-gray-500">¥{Number(product.price).toLocaleString()}</span>
                ) : null}
              </div>
            </div>
            <button
              onClick={onEdit}
              className="flex-shrink-0 w-7 h-7 flex items-center justify-center text-gray-300 hover:text-gray-500 transition-colors"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/>
                <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/>
              </svg>
            </button>
          </div>

          {/* Stock controls */}
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

      {/* Expanded details */}
      {expanded && (
        <div className="border-t border-gray-50 px-4 py-3 bg-gray-50/50">
          <div className="grid grid-cols-2 gap-3 text-xs">
            <div>
              <p className="text-gray-400 mb-0.5">入荷日</p>
              <p className="font-medium text-gray-700">{product.arrivalDate || '—'}</p>
            </div>
            <div>
              <p className="text-gray-400 mb-0.5">販売日</p>
              <p className="font-medium text-gray-700">{product.saleDate || '—'}</p>
            </div>
            {product.notes ? (
              <div className="col-span-2">
                <p className="text-gray-400 mb-0.5">メモ</p>
                <p className="text-gray-700 whitespace-pre-wrap">{product.notes}</p>
              </div>
            ) : null}
          </div>
          <div className="mt-3 flex justify-end">
            <button
              onClick={onDelete}
              className="text-xs text-red-400 active:text-red-600 px-2 py-1"
            >
              削除する
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
