import React, { useState, useRef } from 'react'
import { MagnifyingGlassIcon, FunnelIcon, ArrowLeftIcon } from '@heroicons/react/24/outline'
import FilterSortDropdown from './FilterSortDropdown'

interface Option {
  key: string
  label: string
}

interface Location {
  id: string
  name: string
  address: string
  coordinates: {
    lat: number
    lng: number
  }
}

interface SearchAndFilterProps {
  placeholder?: string
  showFilter?: boolean
  showBackButton?: boolean
  onBackClick?: () => void
  value?: string
  onChange?: (e: React.ChangeEvent<HTMLInputElement>) => void
  onFocus?: (e: React.FocusEvent<HTMLInputElement>) => void
  onSubmit?: (e: React.FormEvent) => void
  onSubmitQuery?: (query: string) => void
  // Filter props
  sortOptions: Option[]
  filterOptions: Option[]
  availableTags: string[]
  sortBy: string
  setSortBy: (key: string) => void
  activeFilters: string[]
  setActiveFilters: (filters: string[]) => void
  selectedTags?: string[]
  setSelectedTags?: (tags: string[]) => void
  onLocationSelect?: (location: Location) => void
  filterCount?: number
  hubFilter?: string | null
  onApplyFilters?: () => void
  onOpenAdvanced?: () => void
  // Positioning
  dropdownPosition?: 'top-right' | 'bottom-right' | 'center'
  distanceKm?: number
  setDistanceKm?: (km: number) => void
}

const SearchAndFilter: React.FC<SearchAndFilterProps> = ({
  placeholder = 'Search...',
  showFilter = true,
  showBackButton = false,
  onBackClick,
  value = '',
  onChange,
  onFocus,
  onSubmit,
  onSubmitQuery,
  sortOptions,
  filterOptions,
  availableTags,
  sortBy,
  setSortBy,
  activeFilters,
  setActiveFilters,
  selectedTags = [],
  setSelectedTags,
  onLocationSelect,
  filterCount = 0,
  hubFilter,
  onOpenAdvanced,
  dropdownPosition = 'top-right',
  distanceKm,
  setDistanceKm
}) => {
  const [showDropdown, setShowDropdown] = useState(false)
  const [internalValue, setInternalValue] = useState<string>(value || '')

  // Keep internal value in sync if controlled
  React.useEffect(() => {
    if (onChange) return
    setInternalValue(value || '')
  }, [value, onChange])
  const filterButtonRef = useRef<HTMLButtonElement>(null)

  const handleFilterClick = () => {
    if (filterButtonRef.current) {
      setShowDropdown(true)
    }
  }

  const handleSortByChange = (newSortBy: string) => {
    setSortBy(newSortBy)
  }

  const getDropdownPosition = () => {
    if (!filterButtonRef.current) return null
    
    const rect = filterButtonRef.current.getBoundingClientRect()
    
    switch (dropdownPosition) {
      case 'top-right':
        return {
          position: 'fixed' as const,
          top: rect.bottom + 4,
          right: '1rem',
          width: 320,
          zIndex: 99999
        }
      case 'bottom-right':
        return {
          position: 'fixed' as const,
          bottom: window.innerHeight - rect.top + 4,
          right: '1rem',
          width: 320,
          zIndex: 99999
        }
      case 'center':
      default:
        return {
          position: 'fixed' as const,
          top: '6rem',
          right: '1rem',
          width: 320,
          zIndex: 99999
        }
    }
  }

  return (
    <div className="relative">
      <div className="flex items-center gap-3">
        {showBackButton && (
          <button
            onClick={onBackClick}
            className="w-10 h-10 bg-white/80 backdrop-blur-sm rounded-xl flex items-center justify-center shadow-soft border border-linen-200 hover:bg-white transition-all duration-300"
          >
            <ArrowLeftIcon className="w-5 h-5 text-charcoal-600" />
          </button>
        )}
        
        <div className="flex-1 relative">
          <div className="relative">
            <MagnifyingGlassIcon className="absolute left-4 top-1/2 transform -translate-y-1/2 w-5 h-5 text-charcoal-600 pointer-events-none z-10" />
            <input
              type="text"
              placeholder={placeholder}
              value={onChange ? value : internalValue}
              onChange={onChange ?? ((e) => setInternalValue(e.target.value))}
              onFocus={onFocus}
              autoComplete="off"
              autoCapitalize="none"
              autoCorrect="off"
              inputMode="search"
              enterKeyHint="search"
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault()
                  if (onSubmit) {
                    // Let parent form handler run as well
                    onSubmit({ preventDefault: () => {}, stopPropagation: () => {} } as unknown as React.FormEvent)
                  }
                  if (onSubmitQuery) {
                    onSubmitQuery(onChange ? (value || '') : internalValue)
                  }
                }
              }}
              className="w-full pl-12 pr-4 py-3 bg-white/80 backdrop-blur-sm border border-linen-200 rounded-2xl text-charcoal-600 placeholder-charcoal-400 focus:outline-none focus:ring-2 focus:ring-sage-200 focus:border-sage-300 shadow-soft transition-all duration-300"
            />
          </div>
        </div>
        
        {showFilter && (
          <button
            ref={filterButtonRef}
            onClick={handleFilterClick}
            className="relative w-10 h-10 bg-white/80 backdrop-blur-sm rounded-xl flex items-center justify-center shadow-soft border border-linen-200 hover:bg-white transition-all duration-300"
          >
            <FunnelIcon className="w-5 h-5 text-sage-600" />
            {filterCount > 0 && (
              <div className="absolute -top-1 -right-1 w-5 h-5 bg-sage-500 text-white text-xs rounded-full flex items-center justify-center font-medium">
                {filterCount}
              </div>
            )}
          </button>
        )}
      </div>

      <FilterSortDropdown
        sortOptions={sortOptions}
        filterOptions={filterOptions}
        availableTags={availableTags}
        sortBy={sortBy}
        setSortBy={handleSortByChange}
        activeFilters={activeFilters}
        setActiveFilters={setActiveFilters}
        selectedTags={selectedTags}
        setSelectedTags={setSelectedTags}
        show={showDropdown}
        onClose={() => setShowDropdown(false)}
        anchorRect={filterButtonRef.current?.getBoundingClientRect() || null}
        onLocationSelect={onLocationSelect}
        hubFilter={hubFilter}
        onOpenAdvanced={onOpenAdvanced}
        distanceKm={distanceKm}
        setDistanceKm={setDistanceKm}
      />

      {/* Close affordance when dropdown is open */}
      {showDropdown && (
        <button
          aria-label="Close filters"
          className="fixed top-4 right-4 z-[100000] w-9 h-9 rounded-full bg-white/90 shadow-soft border border-linen-200"
          onClick={() => setShowDropdown(false)}
        >
          ✕
        </button>
      )}
    </div>
  )
}

export default SearchAndFilter 