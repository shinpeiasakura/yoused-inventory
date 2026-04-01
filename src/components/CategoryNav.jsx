import { useRef, useEffect } from 'react'
import { ALL_TABS } from '../constants'

export default function CategoryNav({ active, onChange }) {
  const scrollRef = useRef(null)

  // Auto-scroll active tab into view
  useEffect(() => {
    const el = scrollRef.current
    if (!el) return
    const activeBtn = el.querySelector('[data-active="true"]')
    if (activeBtn) {
      activeBtn.scrollIntoView({ inline: 'center', behavior: 'smooth', block: 'nearest' })
    }
  }, [active])

  return (
    <nav className="bg-[#1A1A1A] border-t border-[#2a2a2a]">
      <div
        ref={scrollRef}
        className="flex overflow-x-auto scrollbar-hide"
        style={{ WebkitOverflowScrolling: 'touch' }}
      >
        {ALL_TABS.map(tab => {
          const isActive = active === tab
          const isCash = tab === 'Cash&Others'
          return (
            <button
              key={tab}
              data-active={isActive}
              onClick={() => onChange(tab)}
              className={`
                flex-shrink-0 px-4 py-3 text-[13px] font-medium whitespace-nowrap
                border-b-2 transition-colors duration-150
                ${isActive
                  ? isCash
                    ? 'text-[#C4956A] border-[#C4956A]'
                    : 'text-white border-white'
                  : 'text-gray-500 border-transparent'
                }
              `}
            >
              {tab}
            </button>
          )
        })}
      </div>
    </nav>
  )
}
