import { useState } from 'react'

export default function ColorTabs({ usedColors, activeColor, onChange, allColors, onAddColor }) {
  const [showAdd, setShowAdd] = useState(false)
  const [newName, setNewName] = useState('')
  const [newHex, setNewHex] = useState('#888888')

  const handleAdd = () => {
    const name = newName.trim()
    if (!name) return
    const exists = allColors.find(c => c.name.toLowerCase() === name.toLowerCase())
    if (!exists) {
      onAddColor({ name, hex: newHex })
    }
    setNewName('')
    setNewHex('#888888')
    setShowAdd(false)
  }

  return (
    <div className="bg-[#FDFAF5] border-b border-[#DDD5C5]">
      <div
        className="flex overflow-x-auto scrollbar-hide px-3 py-2.5 gap-2 items-center"
        style={{ WebkitOverflowScrolling: 'touch' }}
      >
        {/* ALL tab */}
        <button
          onClick={() => onChange('all')}
          className={`flex-shrink-0 px-4 py-1.5 text-[11px] tracking-widest uppercase font-semibold transition-all duration-150 border ${
            activeColor === 'all'
              ? 'bg-[#2C1A0E] text-[#F4EFE6] border-[#2C1A0E]'
              : 'bg-transparent text-[#7A6858] border-[#DDD5C5]'
          }`}
          style={{ borderRadius: '2px' }}
        >
          ALL
        </button>

        {/* Color tabs */}
        {usedColors.map(color => (
          <button
            key={color.id}
            onClick={() => onChange(color.id)}
            className={`flex-shrink-0 flex items-center gap-1.5 pl-2 pr-3.5 py-1.5 text-[11px] tracking-wide font-medium transition-all duration-150 border ${
              activeColor === color.id
                ? 'bg-[#2C1A0E] text-[#F4EFE6] border-[#2C1A0E]'
                : 'bg-transparent text-[#7A6858] border-[#DDD5C5]'
            }`}
            style={{ borderRadius: '2px' }}
          >
            <span
              className="w-3.5 h-3.5 rounded-full flex-shrink-0 border border-white/60 shadow-sm"
              style={{ backgroundColor: color.hex }}
            />
            {color.name}
          </button>
        ))}

        {/* Add color button */}
        {!showAdd && (
          <button
            onClick={() => setShowAdd(true)}
            className="flex-shrink-0 w-8 h-8 flex items-center justify-center text-[#A8998A] text-xl font-light border border-[#DDD5C5] hover:border-[#8B5E3C] hover:text-[#8B5E3C] transition-colors"
            style={{ borderRadius: '2px' }}
          >
            +
          </button>
        )}
      </div>

      {/* Inline add color form */}
      {showAdd && (
        <div className="px-3 pb-3 flex items-center gap-2 border-t border-[#EDE7DA] pt-2.5">
          <input
            type="color"
            value={newHex}
            onChange={e => setNewHex(e.target.value)}
            className="w-9 h-9 cursor-pointer border border-[#DDD5C5] p-0.5 flex-shrink-0"
            style={{ borderRadius: '2px' }}
          />
          <input
            type="text"
            value={newName}
            onChange={e => setNewName(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleAdd()}
            placeholder="カラー名 (例: Beige)"
            autoFocus
            className="flex-1 px-3 py-2 border border-[#DDD5C5] text-sm text-[#2C1A0E] bg-[#FDFAF5] focus:outline-none focus:border-[#8B5E3C] placeholder:text-[#A8998A]"
            style={{ borderRadius: '2px' }}
          />
          <button
            onClick={handleAdd}
            className="px-3 py-2 bg-[#2C1A0E] text-[#F4EFE6] text-sm font-medium flex-shrink-0 tracking-wide"
            style={{ borderRadius: '2px' }}
          >
            追加
          </button>
          <button
            onClick={() => setShowAdd(false)}
            className="px-3 py-2 text-[#A8998A] text-sm flex-shrink-0"
          >
            ✕
          </button>
        </div>
      )}
    </div>
  )
}
