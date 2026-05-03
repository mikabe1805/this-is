import { MagnifyingGlassIcon, XMarkIcon } from '@heroicons/react/24/outline'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'

interface SearchOverlayProps {
  isOpen: boolean
  onClose: () => void
  initialQuery?: string
  recentSearches?: string[]
  popularTags?: string[]
}

export default function SearchOverlay({
  isOpen,
  onClose,
  initialQuery = '',
  recentSearches = [],
  popularTags = [],
}: SearchOverlayProps) {
  const [q, setQ] = useState(initialQuery)
  const inputRef = useRef<HTMLInputElement>(null)
  const navigate = useNavigate()

  useEffect(() => {
    if (isOpen) {
      setQ(initialQuery)
      requestAnimationFrame(() => inputRef.current?.focus())
    }
  }, [isOpen, initialQuery])

  const submit = (query: string) => {
    const trimmed = query.trim()
    if (!trimmed) return
    onClose()
    navigate(`/search?q=${encodeURIComponent(trimmed)}`)
  }

  const visibleRecents = useMemo(() => recentSearches.slice(0, 6), [recentSearches])
  const visibleTags = useMemo(() => popularTags.slice(0, 12), [popularTags])

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-[10010] bg-[#FAF7F1] flex flex-col animate-fade-slow">
      <div className="flex items-center gap-2 px-3 py-3 border-b border-stone-200">
        <button
          type="button"
          onClick={onClose}
          className="h-10 w-10 rounded-full hover:bg-stone-100 flex items-center justify-center"
          aria-label="Close search"
        >
          <XMarkIcon className="w-5 h-5 text-stone-700" />
        </button>
        <div className="flex-1 flex items-center gap-2 h-11 px-3.5 rounded-xl bg-white border border-stone-200 focus-within:border-stone-400 transition-colors">
          <MagnifyingGlassIcon className="w-[18px] h-[18px] text-stone-400 shrink-0" />
          <input
            ref={inputRef}
            value={q}
            onChange={e => setQ(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') submit(q) }}
            placeholder="Search places, lists, friends"
            className="flex-1 bg-transparent outline-none text-[15px] text-stone-900 placeholder:text-stone-400"
          />
          {q && (
            <button
              type="button"
              onClick={() => setQ('')}
              className="text-stone-400 hover:text-stone-600"
              aria-label="Clear"
            >
              <XMarkIcon className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-4 pt-4 pb-12">
        {visibleRecents.length > 0 && (
          <section className="mb-6">
            <h3 className="text-[12px] font-semibold uppercase tracking-wider text-stone-500 mb-2.5">
              Recent
            </h3>
            <ul className="space-y-1">
              {visibleRecents.map(r => (
                <li key={r}>
                  <button
                    type="button"
                    onClick={() => submit(r)}
                    className="w-full flex items-center gap-3 px-2 py-2.5 rounded-lg hover:bg-stone-100 text-left"
                  >
                    <MagnifyingGlassIcon className="w-4 h-4 text-stone-400 shrink-0" />
                    <span className="text-[14px] text-stone-800 truncate">{r}</span>
                  </button>
                </li>
              ))}
            </ul>
          </section>
        )}

        {visibleTags.length > 0 && (
          <section>
            <h3 className="text-[12px] font-semibold uppercase tracking-wider text-stone-500 mb-2.5">
              Popular
            </h3>
            <div className="flex flex-wrap gap-2">
              {visibleTags.map(t => (
                <button
                  key={t}
                  type="button"
                  onClick={() => submit(t)}
                  className="px-3.5 h-8 rounded-full bg-white border border-stone-200 text-[13px] text-stone-700 hover:border-stone-300"
                >
                  {t}
                </button>
              ))}
            </div>
          </section>
        )}

        {visibleRecents.length === 0 && visibleTags.length === 0 && (
          <p className="text-center text-[14px] text-stone-500 mt-12">
            Start typing to search.
          </p>
        )}
      </div>
    </div>
  )
}
