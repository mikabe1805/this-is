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
  // Map to design-system "pill" primitives for consistency across the app
  const base = 'pill'
  const sizes: Record<Size, string> = { sm: 'h-[40px] px-4 text-[13px]', md: 'h-[44px] px-5 text-[14px]' }
  const variantClass: Record<Variant, string> = {
    primary: 'pill--primary',
    secondary: 'pill--quiet',
    ghost: 'pill--quiet'
  }
  return <Tag className={cx(base, sizes[size], variantClass[variant], className)} {...(props as any)} />
}

export default Button
