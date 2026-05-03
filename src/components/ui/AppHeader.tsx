import { MagnifyingGlassIcon, MapIcon } from '@heroicons/react/24/outline'
import type { ReactNode } from 'react'

interface AppHeaderProps {
  title: string
  eyebrow?: string
  subtitle?: string
  searchPlaceholder?: string
  onSearchFocus?: () => void
  onMap?: () => void
  rightSlot?: ReactNode
  showSearch?: boolean
}

export default function AppHeader({
  title,
  eyebrow,
  subtitle,
  searchPlaceholder = 'Search places, lists, friends',
  onSearchFocus,
  onMap,
  rightSlot,
  showSearch = true,
}: AppHeaderProps) {
  return (
    <header className="sticky top-0 z-30 bg-paper/90 backdrop-blur-md">
      <div className="px-5 pt-5 pb-4">
        <div className="flex items-start justify-between mb-4 gap-3">
          <div className="min-w-0">
            {eyebrow && (
              <p className="label-eyebrow text-ink-mute mb-2">{eyebrow}</p>
            )}
            <h1 className="font-display text-[36px] leading-[0.95] text-ink">
              {title}
            </h1>
            {subtitle && (
              <p className="text-[14px] text-ink-soft mt-2 truncate">{subtitle}</p>
            )}
          </div>
          {rightSlot}
        </div>

        {showSearch && (
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onSearchFocus}
              className="flex-1 flex items-center gap-2.5 h-11 px-4 rounded-full bg-card text-left text-[14px] text-ink-mute border border-edge hover:border-ink/30 transition-colors"
            >
              <MagnifyingGlassIcon className="w-[18px] h-[18px] text-ink-mute shrink-0" />
              <span className="truncate">{searchPlaceholder}</span>
            </button>
            {onMap && (
              <button
                type="button"
                onClick={onMap}
                className="h-11 w-11 rounded-full bg-card border border-edge flex items-center justify-center hover:border-ink/30 transition-colors"
                aria-label="Map view"
              >
                <MapIcon className="w-[18px] h-[18px] text-ink" />
              </button>
            )}
          </div>
        )}
      </div>
      <div className="border-b border-edge mx-5" />
    </header>
  )
}
