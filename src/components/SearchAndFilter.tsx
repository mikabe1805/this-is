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
  // Positioning
  dropdownPosition?: 'top-right' | 'bottom-right' | 'center'
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
  dropdownPosition = 'top-right'
}) => {
  const [showDropdown, setShowDropdown] = useState(false)
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
              value={onChange ? value : undefined}
              defaultValue={!onChange ? value : undefined}
              onChange={onChange}
              onFocus={onFocus}
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
      />
    </div>
  )
}

export default SearchAndFilter 