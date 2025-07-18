import React from 'react'
import { MagnifyingGlassIcon, FunnelIcon, ArrowLeftIcon } from '@heroicons/react/24/outline'

interface SearchBarProps {
  placeholder?: string
  onFilterClick?: () => void
  showFilter?: boolean
  filterButtonRef?: React.RefObject<HTMLButtonElement | null>
  showBackButton?: boolean
  onBackClick?: () => void
  value?: string
  onChange?: (e: React.ChangeEvent<HTMLInputElement>) => void
  onFocus?: (e: React.FocusEvent<HTMLInputElement>) => void
}

const SearchBar = ({
  placeholder = 'Search...',
  onFilterClick,
  showFilter = true,
  filterButtonRef,
  showBackButton = false,
  onBackClick,
  value,
  onChange,
  onFocus
}: SearchBarProps) => {
  return (
    <div className="flex items-center bg-white/90 shadow-soft border border-cream-200 rounded-pill px-3 py-2 gap-2">
      {showBackButton && (
        <button type="button" onClick={onBackClick} className="mr-1 p-1 rounded-full hover:bg-linen-100 focus:outline-none">
          <ArrowLeftIcon className="w-5 h-5 text-brown-500/70" />
        </button>
      )}
      <div className="relative flex-1">
        <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-brown-500/70 pointer-events-none z-10" />
        <input
          type="text"
          placeholder={placeholder}
          className="w-full pl-10 pr-12 py-2 bg-transparent outline-none text-brown-600 placeholder-brown-500/50 text-sm"
          value={value}
          onChange={onChange}
          onFocus={onFocus}
        />
      </div>
      {showFilter && (
        <button type="button" onClick={onFilterClick} className="focus:outline-none" ref={filterButtonRef}>
          <FunnelIcon className="w-5 h-5 text-brown-500/70" />
        </button>
      )}
    </div>
  )
}

export default SearchBar 