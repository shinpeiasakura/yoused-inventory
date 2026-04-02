import { useEffect } from 'react'

export default function Modal({ children, onClose, title }) {
  useEffect(() => {
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = prev }
  }, [])

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-[#2C1A0E]/50 backdrop-blur-sm"
        onClick={onClose}
      />
      {/* Sheet */}
      <div className="relative bg-[#FDFAF5] w-full rounded-t-2xl max-h-[92dvh] flex flex-col z-10" style={{ boxShadow: '0 -4px 32px rgba(44,26,14,0.18)' }}>
        {/* Handle */}
        <div className="flex-shrink-0 flex items-center justify-center pt-3 pb-1">
          <div className="w-8 h-0.5 bg-[#DDD5C5] rounded-full" />
        </div>
        {/* Title bar */}
        {title && (
          <div className="flex-shrink-0 flex items-center justify-between px-5 pb-3 pt-1 border-b border-[#EDE7DA]">
            <h2 className="font-serif text-base font-medium text-[#2C1A0E] tracking-wide">{title}</h2>
            <button
              onClick={onClose}
              className="w-8 h-8 flex items-center justify-center text-[#A8998A] hover:text-[#2C1A0E] transition-colors text-xl"
            >
              ×
            </button>
          </div>
        )}
        {/* Content */}
        <div className="flex-1 overflow-y-auto overscroll-contain">
          {children}
        </div>
      </div>
    </div>
  )
}
