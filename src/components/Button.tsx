import React from 'react'

type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary' | 'secondary' | 'ghost' | 'dark' | 'danger' | 'success'
  size?: 'sm' | 'md' | 'lg'
  fullWidth?: boolean
  icon?: React.ReactNode
  iconPosition?: 'left' | 'right'
}

export default function Button({
  variant = 'primary',
  size = 'md',
  fullWidth = false,
  icon,
  iconPosition = 'left',
  className = '',
  children,
  ...props
}: ButtonProps) {
  const base = 'inline-flex items-center justify-center rounded-full font-medium focus:outline-none focus-visible:ring-2 focus-visible:ring-sage-300 focus-visible:ring-offset-2 transition-all duration-200 disabled:cursor-not-allowed'

  const sizes = {
    sm: 'px-3 py-1.5 text-sm min-h-[36px] gap-1.5',
    md: 'px-4 py-2 text-sm min-h-[40px] gap-2',
    lg: 'px-5 py-2.5 text-base min-h-[44px] gap-2.5'
  }[size]

  const variants = {
    primary: 'text-white bg-sage-600 hover:bg-sage-700 active:bg-sage-800 disabled:opacity-50 shadow-soft hover:shadow-cozy',
    secondary: 'bg-white border border-linen-200 text-charcoal-800 hover:bg-linen-50 active:bg-linen-100 disabled:opacity-50 shadow-soft',
    ghost: 'bg-transparent text-charcoal-700 hover:bg-linen-50 active:bg-linen-100 disabled:opacity-40',
    dark: 'text-white bg-charcoal-700 hover:bg-charcoal-800 active:bg-charcoal-900 disabled:opacity-50 shadow-soft',
    danger: 'text-white bg-coral-500 hover:bg-coral-600 active:bg-coral-700 disabled:opacity-50 shadow-soft',
    success: 'text-white bg-sage-500 hover:bg-sage-600 active:bg-sage-700 disabled:opacity-50 shadow-soft'
  }[variant]

  const widthClass = fullWidth ? 'w-full' : ''

  return (
    <button
      className={`${base} ${sizes} ${variants} ${widthClass} ${className}`}
      {...props}
    >
      {icon && iconPosition === 'left' && <span className="shrink-0">{icon}</span>}
      {children && <span>{children}</span>}
      {icon && iconPosition === 'right' && <span className="shrink-0">{icon}</span>}
    </button>
  )
}


