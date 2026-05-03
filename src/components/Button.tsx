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
    primary: 'btn-cta disabled:opacity-50',
    secondary: 'bg-card border border-edge text-ink hover:border-ink/40 disabled:opacity-50',
    ghost: 'bg-transparent text-ink-soft hover:text-ink hover:bg-paper-deep',
    dark: 'text-ink bg-paper hover:bg-paper-deep border border-edge disabled:opacity-50'
  }[variant]
  return <button className={`${base} ${sizes} ${variants} ${className}`} {...props} />
}


