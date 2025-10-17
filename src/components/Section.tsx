import React from 'react'

type SectionProps = {
  title?: string
  action?: React.ReactNode
  children: React.ReactNode
  className?: string
}

export default function Section({ title, action, children, className = '' }: SectionProps) {
  return (
    <section className={`space-y-4 ${className}`}>
      {(title || action) && (
        <div className="flex items-center justify-between mb-1">
          {title ? <h2 className="text-[18px] font-semibold" style={{color: 'rgba(61,54,48,0.95)', letterSpacing: '-0.01em'}}>{title}</h2> : <div />}
          {action}
        </div>
      )}
      {children}
    </section>
  )}


