// 本日の販売タブ: 販売日が今日の商品を全カテゴリーから抽出して閲覧のみ表示

function todayStr() {
  return new Date().toISOString().slice(0, 10)
}

function TodaySalesCard({ product, color }) {
  return (
    <div
      style={{
        borderRadius: '3px',
        boxShadow: '0 1px 4px rgba(44,26,14,0.08)',
        overflow: 'hidden',
        display: 'flex',
        backgroundColor: '#FDFAF5',
      }}
    >
      {/* 左カラーアクセントバー */}
      <div style={{ width: 4, backgroundColor: '#5B8C5A', flexShrink: 0 }} />

      <div className="flex-1 px-3 py-3">
        {/* 商品名 + カテゴリー */}
        <div className="flex items-start justify-between gap-2 mb-1.5">
          <h3 className="font-serif font-medium text-[#2C1A0E] text-[13px] leading-snug">
            {product.name || '名称未設定'}
          </h3>
          <span className="text-[9px] text-[#A8998A] tracking-widest uppercase flex-shrink-0 mt-0.5">
            {product.category}
          </span>
        </div>

        {/* カラー + サイズ */}
        <div className="flex items-center gap-1.5 flex-wrap mb-2.5">
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
        </div>

        {/* 価格 + 販売日 */}
        <div className="flex items-end justify-between gap-2">
          {product.price ? (
            <p className="text-[16px] font-bold text-[#2C1A0E] tracking-tight">
              ¥{Number(product.price).toLocaleString()}
            </p>
          ) : (
            <p className="text-[11px] text-[#C4B8A8]">価格未設定</p>
          )}
          <span className="text-[10px] text-[#A8998A] tabular-nums">{product.saleDate}</span>
        </div>
      </div>
    </div>
  )
}

export default function TodaySalesView({ products, colors }) {
  const today = todayStr()
  const todayProducts = products
    .filter(p => p.saleDate === today)
    .sort((a, b) => {
      const ca = (a.category ?? '').localeCompare(b.category ?? '', 'ja')
      if (ca !== 0) return ca
      const na = (a.name ?? '').localeCompare(b.name ?? '', 'ja', { numeric: true, sensitivity: 'base' })
      if (na !== 0) return na
      return (a.size ?? '').localeCompare(b.size ?? '', 'ja', { numeric: true, sensitivity: 'base' })
    })

  const totalItems = todayProducts.length
  const totalPrice = todayProducts.reduce((s, p) => s + (Number(p.price) || 0), 0)

  return (
    <div>
      {/* サマリーバー */}
      <div className="px-4 py-2.5 bg-[#FDFAF5] border-b border-[#DDD5C5] flex items-center gap-4">
        <span className="text-[11px] font-semibold text-[#2C1A0E] tracking-wide">
          {totalItems} 点
        </span>
        {totalPrice > 0 && (
          <span className="text-[11px] text-[#A8998A]">
            売上合計{' '}
            <span className="font-semibold text-[#2D5A2D]">
              ¥{totalPrice.toLocaleString()}
            </span>
          </span>
        )}
        <span className="ml-auto text-[10px] text-[#C4B8A8] tracking-wide tabular-nums">
          {today}
        </span>
      </div>

      {totalItems === 0 ? (
        <div className="text-center py-20">
          <svg width="44" height="44" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="0.8" className="mx-auto mb-4 text-[#C4B8A8]">
            <path d="M20 12V22H4V12"/>
            <path d="M22 7H2v5h20V7z"/>
            <path d="M12 22V7"/>
            <path d="M12 7H7.5a2.5 2.5 0 010-5C11 2 12 7 12 7z"/>
            <path d="M12 7h4.5a2.5 2.5 0 000-5C13 2 12 7 12 7z"/>
          </svg>
          <p className="font-serif text-sm text-[#A8998A] mb-1">本日の販売はありません</p>
          <p className="text-[11px] text-[#C4B8A8] tracking-wide">
            商品の販売日に今日の日付を入力すると自動で表示されます
          </p>
        </div>
      ) : (
        <div className="p-3 space-y-2">
          {todayProducts.map(product => (
            <TodaySalesCard
              key={product.id}
              product={product}
              color={colors.find(c => c.id === product.colorId)}
            />
          ))}
        </div>
      )}
    </div>
  )
}
