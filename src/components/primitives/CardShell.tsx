import React from 'react'

interface CardShellProps {
  children: React.ReactNode
  variant?: 'solid' | 'glass'
  className?: string
  onClick?: () => void
  style?: React.CSSProperties
}

// Aligns with components/ui/CardShell for consistent padding/radius/elevation.
// Default treatment is a quiet glass surface; opt into hover lift via className on interactive cards.
export function CardShell({
  children,
  variant = 'solid',
  className = '',
  onClick,
  style
}: CardShellProps) {
  const base = variant === 'glass'
    ? 'relative glass-card rounded-2xl p-4 md:p-5'
    : 'panel rounded-2xl p-4 md:p-5'
  const clickable = onClick ? 'cursor-pointer interactive-glass' : ''
  return (
    <div className={`${base} ${clickable} ${className}`} onClick={onClick} style={style}>
      {children}
    </div>
  )
}
