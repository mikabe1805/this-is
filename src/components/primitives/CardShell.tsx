import React from 'react'

interface CardShellProps {
  children: React.ReactNode
  variant?: 'solid' | 'glass'
  className?: string
  onClick?: () => void
  style?: React.CSSProperties
}

// Aligns with components/ui/CardShell for consistent padding/radius/elevation
export function CardShell({ 
  children, 
  variant = 'solid', 
  className = '',
  onClick,
  style
}: CardShellProps) {
  const base = variant === 'glass' 
    ? 'relative glass-card rounded-xl2 p-4 md:p-5 interactive-glass group hover-lift hover-lift-on animate-fade-in'
    : 'panel rounded-2xl p-4 md:p-5'
  const clickable = onClick ? 'cursor-pointer' : ''
  return (
    <div className={`${base} ${clickable} ${className}`} onClick={onClick} style={style}>
      {children}
    </div>
  )
}
