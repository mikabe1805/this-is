import React from 'react'

type TagPillProps = {
  label: string
  onClick?: (e: React.MouseEvent<HTMLButtonElement>) => void
  className?: string
  size?: 'sm' | 'md'
  removable?: boolean
  onRemove?: () => void
  selected?: boolean
  disabled?: boolean
  icon?: React.ReactNode
  count?: number
  ariaLabel?: string
}

export default function TagPill({
  label,
  onClick,
  className = '',
  size = 'md',
  removable = false,
  onRemove,
  selected = false,
  disabled = false,
  icon,
  count,
  ariaLabel
}: TagPillProps) {
  const sizeClasses = size === 'sm'
    ? 'h-[28px] px-3 text-[12px]'
    : 'h-[32px] px-3.5 text-[13px]'

  // Use design-system pill primitives for consistent look
  const baseClasses = `pill pill--quiet inline-flex items-center gap-1.5 hover-lift`

  const stateClasses = selected
    ? 'ring-2 ring-white/50'
    : ''

  const disabledClasses = disabled ? 'opacity-60 cursor-not-allowed' : 'cursor-pointer active:scale-[0.98]'

  const labelText = `#${label}`
  const computedAria = ariaLabel || `${labelText}${typeof count === 'number' ? ` (${count})` : ''}`

  return (
    <span className={`group ${className}`}>
      <button
        type="button"
        onClick={onClick}
        aria-label={computedAria}
        aria-pressed={selected}
        disabled={disabled}
        className={`${baseClasses} ${sizeClasses} ${stateClasses} ${disabledClasses}`}
      >
        {icon ? <span className="shrink-0 text-current/80">{icon}</span> : null}
        <span className="whitespace-nowrap">{labelText}</span>
        {typeof count === 'number' && (
          <span className="ml-0.5 inline-flex items-center justify-center rounded-full bg-white/60 text-bark-800 text-[11px] leading-none px-1.5 py-0.5">
            {count}
          </span>
        )}
      </button>
      {removable && (
        <button
          type="button"
          aria-label={`Remove ${labelText}`}
          onClick={(e) => { e.stopPropagation(); if (onRemove) onRemove() }}
          className={`ml-1 inline-flex h-5 w-5 items-center justify-center rounded-full border border-linen-200 bg-white/90 text-charcoal-500 transition-colors hover:text-charcoal-700 hover:bg-linen-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-sage-300`}
        >
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-3.5 w-3.5">
            <path fillRule="evenodd" d="M10 8.586L14.95 3.636a1 1 0 111.414 1.414L11.414 10l4.95 4.95a1 1 0 01-1.414 1.414L10 11.414l-4.95 4.95a1 1 0 01-1.414-1.414L8.586 10l-4.95-4.95A1 1 0 115.05 3.636L10 8.586z" clipRule="evenodd" />
          </svg>
        </button>
      )}
    </span>
  )
}

