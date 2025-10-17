import React from 'react'

type CardProps = React.HTMLAttributes<HTMLElement> & {
  children?: React.ReactNode
  className?: string
  as?: keyof JSX.IntrinsicElements
  interactive?: boolean
}

// Small, consistent card wrapper to unify spacing and elevation
export default function Card({ children, className = '', as = 'div', interactive = false, ...rest }: CardProps) {
  const Element: any = as
  return (
    <Element
      className={
        `${interactive ? 'glass-card interactive-glass' : 'glass-card'} rounded-2xl ` +
        className
      }
      {...rest}
    >
      {children}
    </Element>
  )
}


