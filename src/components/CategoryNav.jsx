import { useRef, useEffect } from 'react'
import { ALL_TABS } from '../constants'

export default function CategoryNav({ active, onChange }) {
  const scrollRef = useRef(null)

  useEffect(() => {
    const el = scrollRef.current
    if (!el) return
    const activeBtn = el.querySelector('[data-active="true"]')
    if (activeBtn) {
      activeBtn.scrollIntoView({ inline: 'center', behavior: 'smooth', block: 'nearest' })
    }
  }, [active])

  return (
    <nav className="bg-[#FDFAF5] border-b border-[#DDD5C5]">
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
                flex-shrink-0 px-4 py-3 text-[12px] tracking-widest whitespace-nowrap
                border-b-2 transition-all duration-150 font-medium uppercase
                ${isActive
                  ? isCash
                    ? 'text-[#8B5E3C] border-[#8B5E3C]'
                    : 'text-[#2C1A0E] border-[#2C1A0E]'
                  : 'text-[#A8998A] border-transparent'
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
