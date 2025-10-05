import React from 'react'

type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary' | 'secondary' | 'ghost' | 'dark'
  size?: 'sm' | 'md' | 'lg'
}

export default function Button({ variant = 'primary', size = 'md', className = '', ...props }: ButtonProps) {
  const base = 'inline-flex items-center justify-center rounded-full font-medium focus:outline-none'
  const sizes = {
    sm: 'px-3 py-1.5 text-sm',
    md: 'px-4 py-2 text-sm',
    lg: 'px-5 py-2.5 text-base'
  }[size]
  const variants = {
    primary: 'text-white bg-sage-600 hover:bg-sage-700 disabled:opacity-50',
    secondary: 'bg-white border border-linen-200 text-charcoal-800 hover:bg-linen-50 disabled:opacity-50',
    ghost: 'bg-transparent text-charcoal-700 hover:bg-linen-50',
    dark: 'text-black bg-white/90 hover:bg-white disabled:opacity-50'
  }[variant]
  return <button className={`${base} ${sizes} ${variants} ${className}`} {...props} />
}


