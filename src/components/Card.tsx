import React from 'react'

type CardProps = React.HTMLAttributes<HTMLElement> & {
  children?: React.ReactNode
  className?: string
  as?: keyof JSX.IntrinsicElements
  interactive?: boolean
  shadow?: 'none' | 'soft' | 'cozy' | 'botanical' | 'crystal'
  padding?: 'none' | 'sm' | 'md' | 'lg'
}

// Small, consistent card wrapper to unify spacing and elevation
export default function Card({
  children,
  className = '',
  as = 'div',
  interactive = false,
  shadow = 'botanical',
  padding = 'none',
  ...rest
}: CardProps) {
  const Element: any = as

  const shadowClass = shadow !== 'none' ? `shadow-${shadow}` : ''
  const paddingClasses = {
    'none': '',
    'sm': 'p-3',
    'md': 'p-4',
    'lg': 'p-6'
  }[padding]

  return (
    <Element
      className={
        `bg-white rounded-xl border border-linen-200 ${shadowClass} ${paddingClasses} ${interactive ? 'hover:bg-linen-50 hover:shadow-liquid transition-all duration-200' : ''} ` +
        className
      }
      {...rest}
    >
      {children}
    </Element>
  )
}


