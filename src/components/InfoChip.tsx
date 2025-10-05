import React from 'react'

type InfoChipProps = {
  label: string
  tone?: 'neutral' | 'success' | 'warning' | 'danger' | 'brand'
  className?: string
}

export default function InfoChip({ label, tone = 'neutral', className = '' }: InfoChipProps) {
  const toneClass = {
    neutral: 'bg-linen-100 text-charcoal-700 border-linen-200',
    success: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    warning: 'bg-amber-50 text-amber-700 border-amber-200',
    danger: 'bg-red-50 text-red-700 border-red-200',
    brand: 'bg-sage-50 text-sage-700 border-sage-200'
  }[tone]
  return (
    <span className={`px-2 py-0.5 rounded-full text-[11px] border ${toneClass} ${className}`}>{label}</span>
  )
}


