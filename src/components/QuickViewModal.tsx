import React from 'react'
import InfoChip from './InfoChip'

type QuickViewProps = {
  isOpen: boolean
  onClose: () => void
  title: string
  subtitle?: string
  image?: string
  meta?: string
  actions?: React.ReactNode
  badge?: string
  chips?: Array<{ label: string; tone?: 'neutral' | 'success' | 'warning' | 'danger' | 'brand' }>
}

export default function QuickViewModal({ isOpen, onClose, title, subtitle, image, meta, actions, badge, chips = [] }: QuickViewProps) {
  if (!isOpen) return null
  return (
    <div className="fixed inset-0 z-[10020] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-md bg-white rounded-2xl shadow-crystal border border-linen-200 overflow-hidden">
        {/* media */}
        {image && (
          <div className="w-full h-48 bg-linen-100 relative">
            <img src={image} alt={title} className="absolute inset-0 w-full h-full object-cover" onError={(e)=>{ (e.currentTarget as HTMLImageElement).src='/assets/leaf.png' }} />
            <div className="absolute inset-x-0 top-0 h-12 bg-gradient-to-b from-black/25 to-transparent" />
            {badge && (
              <div className="absolute top-3 left-3 px-2 py-1 text-[11px] rounded-full bg-white/85 border border-linen-200 text-charcoal-700 shadow-soft">{badge}</div>
            )}
            <button onClick={onClose} className="absolute top-2 right-2 btn-icon bg-black/40 text-white hover:bg-black/60 border-0">✕</button>
          </div>
        )}
        {/* content */}
        <div className="p-4">
          <h3 className="font-semibold text-charcoal-800 text-base line-clamp-2">{title}</h3>
          {subtitle && <p className="text-sm text-charcoal-600 mt-1 line-clamp-2">{subtitle}</p>}
          {meta && <p className="text-xs text-charcoal-500 mt-2">{meta}</p>}
          {chips.length > 0 && (
            <div className="mt-2 flex items-center gap-1 flex-wrap">
              {chips.map((c, i)=> <InfoChip key={i} label={c.label} tone={c.tone} />)}
            </div>
          )}
          {actions && <div className="mt-4 flex items-center gap-2 flex-wrap">{actions}</div>}
        </div>
      </div>
    </div>
  )
}


