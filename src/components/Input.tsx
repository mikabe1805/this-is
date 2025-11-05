import React from 'react'

type InputProps = React.InputHTMLAttributes<HTMLInputElement> & {
  label?: string
  error?: string
  helperText?: string
  icon?: React.ReactNode
  iconPosition?: 'left' | 'right'
  fullWidth?: boolean
}

// Standardized input component for consistent form styling
export default function Input({
  label,
  error,
  helperText,
  icon,
  iconPosition = 'left',
  fullWidth = true,
  className = '',
  id,
  ...props
}: InputProps) {
  const inputId = id || `input-${Math.random().toString(36).substr(2, 9)}`
  const hasError = !!error

  const inputClasses = `
    px-4 py-2.5 text-sm bg-white border rounded-lg
    focus:outline-none focus:ring-2 transition-colors
    placeholder:text-charcoal-400
    disabled:bg-linen-50 disabled:cursor-not-allowed disabled:opacity-60
    ${hasError
      ? 'border-coral-300 focus:ring-coral-300 focus:border-coral-300'
      : 'border-linen-200 focus:ring-sage-300 focus:border-sage-300'
    }
    ${icon && iconPosition === 'left' ? 'pl-11' : ''}
    ${icon && iconPosition === 'right' ? 'pr-11' : ''}
    ${fullWidth ? 'w-full' : ''}
    ${className}
  `.trim()

  return (
    <div className={fullWidth ? 'w-full' : ''}>
      {label && (
        <label
          htmlFor={inputId}
          className="block text-sm font-medium text-charcoal-700 mb-1.5"
        >
          {label}
        </label>
      )}

      <div className="relative">
        {icon && iconPosition === 'left' && (
          <div className="absolute left-3 top-1/2 -translate-y-1/2 text-charcoal-400">
            {icon}
          </div>
        )}

        <input
          id={inputId}
          className={inputClasses}
          aria-invalid={hasError}
          aria-describedby={
            error ? `${inputId}-error` : helperText ? `${inputId}-helper` : undefined
          }
          {...props}
        />

        {icon && iconPosition === 'right' && (
          <div className="absolute right-3 top-1/2 -translate-y-1/2 text-charcoal-400">
            {icon}
          </div>
        )}
      </div>

      {error && (
        <p id={`${inputId}-error`} className="mt-1.5 text-xs text-coral-600">
          {error}
        </p>
      )}

      {helperText && !error && (
        <p id={`${inputId}-helper`} className="mt-1.5 text-xs text-charcoal-500">
          {helperText}
        </p>
      )}
    </div>
  )
}
