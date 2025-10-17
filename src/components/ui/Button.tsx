import React from 'react'

type Variant = 'primary' | 'secondary' | 'ghost'
type Size = 'sm' | 'md'

function cx(...parts: Array<string | undefined | null | false>) {
  return parts.filter(Boolean).join(' ')
}

export function Button({
  as: Tag = 'button',
  variant = 'primary',
  size = 'md',
  className,
  ...props
}: React.ComponentPropsWithoutRef<'button'> & { as?: any; variant?: Variant; size?: Size }) {
  const base = 'inline-flex items-center justify-center rounded-full font-medium select-none transition focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-transparent'
  const sizes: Record<Size, string> = { sm: 'h-9 px-4 text-[13px]', md: 'h-11 px-5 text-[14px]' }
  const variants: Record<Variant, string> = {
    primary: 'bg-gradient-to-b from-moss-600 to-moss-700 text-white shadow-[0_2px_8px_rgba(61,54,48,0.12)] hover:brightness-[1.05] active:brightness-[0.98] shimmer shimmer-run hover-lift hover-lift-on',
    secondary: 'bg-white/22 border border-white/26 text-bark-900 backdrop-blur-md hover:bg-white/28 hover-lift',
    ghost: 'bg-transparent text-bark-700 hover:bg-white/16 border border-transparent'
  }
  return (
    <Tag className={cx(base, sizes[size], variants[variant], className)} {...props} />
  )
}

export default Button
