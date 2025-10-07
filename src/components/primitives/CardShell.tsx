import React from 'react'

interface CardShellProps {
  children: React.ReactNode
  variant?: 'solid' | 'glass'
  className?: string
  onClick?: () => void
}

/**
 * CardShell - Unified card container primitive
 * 
 * Use 'solid' for opaque content cards (default)
 * Use 'glass' for overlay cards or transparent effects
 */
export function CardShell({ 
  children, 
  variant = 'solid', 
  className = '',
  onClick 
}: CardShellProps) {
  const baseClass = variant === 'glass' ? 'glass' : 'panel'
  const interactiveClass = onClick ? 'cursor-pointer transition-transform hover:scale-[1.02]' : ''
  
  return (
    <div 
      className={`${baseClass} p-3 rounded-xl ${interactiveClass} ${className}`}
      onClick={onClick}
    >
      {children}
    </div>
  )
}
