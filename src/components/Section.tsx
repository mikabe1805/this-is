import React from 'react'

type SectionProps = {
  title?: string
  action?: React.ReactNode
  children: React.ReactNode
  className?: string
}

export default function Section({ title, action, children, className = '' }: SectionProps) {
  return (
    <section className={`space-y-3 ${className}`}>
      {(title || action) && (
        <div className="flex items-center justify-between">
          {title ? <h2 className="type-title text-charcoal-800">{title}</h2> : <div />}
          {action}
        </div>
      )}
      {children}
    </section>
  )}


