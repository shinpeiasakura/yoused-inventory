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
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />
      {/* Sheet */}
      <div className="relative bg-white w-full rounded-t-3xl max-h-[92dvh] flex flex-col z-10 shadow-2xl">
        {/* Handle */}
        <div className="flex-shrink-0 flex items-center justify-center pt-3 pb-1">
          <div className="w-10 h-1 bg-gray-200 rounded-full" />
        </div>
        {/* Title bar */}
        {title && (
          <div className="flex-shrink-0 flex items-center justify-between px-5 pb-3 border-b border-gray-100">
            <h2 className="text-base font-bold text-[#1A1A1A]">{title}</h2>
            <button
              onClick={onClose}
              className="w-8 h-8 flex items-center justify-center rounded-full bg-gray-100 text-gray-500 text-lg"
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
