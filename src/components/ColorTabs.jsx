import { useState } from 'react'

export default function ColorTabs({ usedColors, activeColor, onChange, allColors, onAddColor }) {
  const [showAdd, setShowAdd] = useState(false)
  const [newName, setNewName] = useState('')
  const [newHex, setNewHex] = useState('#888888')

  const handleAdd = () => {
    const name = newName.trim()
    if (!name) return
    // Check if color with same name already exists
    const exists = allColors.find(c => c.name.toLowerCase() === name.toLowerCase())
    if (!exists) {
      onAddColor({ name, hex: newHex })
    }
    setNewName('')
    setNewHex('#888888')
    setShowAdd(false)
  }

  return (
    <div className="bg-white border-b border-gray-100">
      <div
        className="flex overflow-x-auto scrollbar-hide px-3 py-2.5 gap-2 items-center"
        style={{ WebkitOverflowScrolling: 'touch' }}
      >
        {/* ALL tab */}
        <button
          onClick={() => onChange('all')}
          className={`flex-shrink-0 px-4 py-1.5 rounded-full text-[13px] font-semibold transition-colors ${
            activeColor === 'all'
              ? 'bg-[#1A1A1A] text-white'
              : 'bg-gray-100 text-gray-500'
          }`}
        >
          ALL
        </button>

        {/* Color tabs */}
        {usedColors.map(color => (
          <button
            key={color.id}
            onClick={() => onChange(color.id)}
            className={`flex-shrink-0 flex items-center gap-1.5 pl-2 pr-3.5 py-1.5 rounded-full text-[13px] font-medium transition-colors ${
              activeColor === color.id
                ? 'bg-[#1A1A1A] text-white'
                : 'bg-gray-100 text-gray-600'
            }`}
          >
            <span
              className="w-4 h-4 rounded-full border-2 border-white shadow-sm flex-shrink-0"
              style={{ backgroundColor: color.hex }}
            />
            {color.name}
          </button>
        ))}

        {/* Add color button */}
        {!showAdd && (
          <button
            onClick={() => setShowAdd(true)}
            className="flex-shrink-0 w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center text-gray-400 text-xl font-light"
          >
            +
          </button>
        )}
      </div>

      {/* Inline add color form */}
      {showAdd && (
        <div className="px-3 pb-3 flex items-center gap-2 border-t border-gray-50 pt-2">
          <input
            type="color"
            value={newHex}
            onChange={e => setNewHex(e.target.value)}
            className="w-9 h-9 rounded-lg cursor-pointer border border-gray-200 p-0.5 flex-shrink-0"
          />
          <input
            type="text"
            value={newName}
            onChange={e => setNewName(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleAdd()}
            placeholder="カラー名 (例: Beige)"
            autoFocus
            className="flex-1 px-3 py-2 rounded-xl border border-gray-200 text-sm focus:outline-none focus:border-[#C4956A]"
          />
          <button
            onClick={handleAdd}
            className="px-3 py-2 bg-[#1A1A1A] text-white text-sm rounded-xl font-medium flex-shrink-0"
          >
            追加
          </button>
          <button
            onClick={() => setShowAdd(false)}
            className="px-3 py-2 text-gray-400 text-sm flex-shrink-0"
          >
            ✕
          </button>
        </div>
      )}
    </div>
  )
}
