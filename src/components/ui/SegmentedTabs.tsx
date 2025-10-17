import React, { useEffect, useMemo, useRef, useState } from 'react'

type Item = { key: string; label: string }

type Props = {
  value: string
  onChange: (v: string) => void
  items: Item[]
  className?: string
}

export default function SegmentedTabs({ value, onChange, items, className = '' }: Props) {
  const trackRef = useRef<HTMLDivElement>(null)
  const [pillStyle, setPillStyle] = useState<{ left: number; width: number }>({ left: 0, width: 0 })

  const idx = useMemo(() => items.findIndex(i => i.key === value), [items, value])

  useEffect(() => {
    const el = trackRef.current
    if (!el) return
    const rect = el.getBoundingClientRect()
    const count = Math.max(items.length, 1)
    const pad = 4 // p-1 => 4px
    const w = Math.max(0, (rect.width - pad * 2) / count)
    const l = pad + w * Math.max(idx, 0)
    setPillStyle({ left: l, width: w })

    const onResize = () => {
      const r = el.getBoundingClientRect()
      const w2 = Math.max(0, (r.width - pad * 2) / count)
      const l2 = pad + w2 * Math.max(idx, 0)
      setPillStyle({ left: l2, width: w2 })
    }
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [idx, items.length])

  const handleKey = (e: React.KeyboardEvent<HTMLDivElement>) => {
    const order = items.map(i => i.key)
    const i = order.indexOf(value)
    if (e.key === 'ArrowRight') {
      e.preventDefault(); onChange(order[Math.min(i + 1, order.length - 1)] as any)
    } else if (e.key === 'ArrowLeft') {
      e.preventDefault(); onChange(order[Math.max(i - 1, 0)] as any)
    } else if (e.key === 'Home') {
      e.preventDefault(); onChange(order[0] as any)
    } else if (e.key === 'End') {
      e.preventDefault(); onChange(order[order.length - 1] as any)
    }
  }

  return (
    <div
      ref={trackRef}
      role="tablist"
      aria-label="Home tabs"
      tabIndex={0}
      onKeyDown={handleKey}
      className={`relative rounded-[18px] p-1 bg-white/40 backdrop-blur-md border border-white/35 shadow-[0_2px_8px_rgba(0,0,0,0.08)] flex select-none transition-all duration-250 ease-in-out focus-visible:ring-2 focus-visible:ring-moss-600/50 ${className}`}
    >
      <div
        data-ui-probe="segpill"
        className="absolute top-1 bottom-1 rounded-[16px] bg-white/92 ring-1 ring-white/50 shadow-[0_2px_6px_rgba(0,0,0,0.10),inset_0_1px_0_rgba(255,255,255,0.30)] transition-all duration-250 ease-in-out"
        style={{ left: pillStyle.left, width: pillStyle.width }}
        aria-hidden="true"
      />
      {items.map((it) => {
        const active = it.key === value
        return (
          <button
            key={it.key}
            role="tab"
            aria-selected={active}
            aria-controls={`panel-${it.key}`}
            onClick={() => onChange(it.key)}
            className={`relative z-[1] flex-1 h-9 px-4 rounded-[16px] transition-all duration-250 ease-in-out text-[14px] focus-visible:ring-2 focus-visible:ring-moss-600/50 active:scale-[0.97] ${
              active ? 'text-bark-900 font-semibold' : 'text-bark-700/80 hover:text-bark-900/90 font-medium'
            }`}
            style={active ? { filter: 'brightness(1.05) saturate(1.1)' } : undefined}
          >
            {it.label}
          </button>
        )
      })}
    </div>
  )
}
