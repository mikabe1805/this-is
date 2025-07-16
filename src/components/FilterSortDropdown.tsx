import React, { useState } from 'react'
import { createPortal } from 'react-dom'
import { EllipsisHorizontalIcon } from '@heroicons/react/24/outline'
import TagSearchModal from './TagSearchModal'

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

interface FilterSortDropdownProps {
  sortOptions: Option[]
  filterOptions: Option[]
  availableTags: string[]
  sortBy: string
  setSortBy: (key: string) => void
  activeFilters: string[]
  setActiveFilters: (filters: string[]) => void
  show: boolean
  onClose: () => void
  anchorRect?: DOMRect | null
  onLocationSelect?: (location: Location) => void
}

const PANEL_WIDTH = 320

const FilterSortDropdown: React.FC<FilterSortDropdownProps> = ({
  sortOptions,
  filterOptions,
  availableTags,
  sortBy,
  setSortBy,
  activeFilters,
  setActiveFilters,
  show,
  onClose,
  anchorRect,
  onLocationSelect
}) => {
  const [showTagSearch, setShowTagSearch] = useState(false)

  if (!show) return null

  const panelStyle = anchorRect
    ? {
        position: 'fixed' as const,
        top: anchorRect.bottom + 4,
        left: anchorRect.right - PANEL_WIDTH,
        width: PANEL_WIDTH,
        zIndex: 99999
      }
    : {
        position: 'fixed' as const,
        top: '6rem',
        right: '1rem',
        width: PANEL_WIDTH,
        zIndex: 99999
      }

  const handleTagSearch = () => {
    setShowTagSearch(true)
  }

  const handleTagsChange = (newTags: string[]) => {
    // Remove any tags that are no longer selected
    const remainingFilters = activeFilters.filter(filter => 
      !availableTags.includes(filter) || newTags.includes(filter)
    )
    // Add any newly selected tags
    const finalFilters = [...new Set([...remainingFilters, ...newTags])]
    setActiveFilters(finalFilters)
  }

  return createPortal(
    <>
      <div className="fixed inset-0 z-[9999] bg-black/10" onClick={onClose}></div>
      <div style={panelStyle} className="rounded-2xl shadow-cozy border border-linen-200 bg-white/95 p-6">
        <div className="mb-6">
          <div className="font-serif font-semibold mb-4 text-lg text-charcoal-700">Sort by</div>
          <div className="space-y-2">
            {sortOptions.map(opt => (
              <label key={opt.key} className="flex items-center gap-3 p-2 rounded-lg cursor-pointer border border-transparent hover:border-sage-200 hover:bg-sage-50">
                <input
                  type="radio"
                  name="sortBy"
                  value={opt.key}
                  checked={sortBy === opt.key}
                  onChange={() => {
                    if (opt.key === 'nearby' && onLocationSelect) {
                      // Don't change sortBy yet, let the parent handle location selection
                      return
                    }
                    setSortBy(opt.key)
                  }}
                  className="w-5 h-5 text-sage-500 focus:ring-sage-400"
                />
                <span className="font-medium text-charcoal-600">{opt.label}</span>
              </label>
            ))}
          </div>
        </div>
        <div>
          <div className="font-serif font-semibold mb-4 text-lg text-charcoal-700">Filter by</div>
          <div className="flex flex-wrap gap-2 mb-4">
            {filterOptions.map(opt => (
              <label key={opt.key} className="flex items-center gap-2 px-3 py-2 rounded-full text-sm font-medium bg-sage-50 border border-sage-100 text-sage-700 hover:bg-sage-100 cursor-pointer">
                <input
                  type="checkbox"
                  checked={activeFilters.includes(opt.key)}
                  onChange={() => setActiveFilters(activeFilters.includes(opt.key) ? activeFilters.filter(x => x !== opt.key) : [...activeFilters, opt.key])}
                  className="w-4 h-4 text-sage-500 focus:ring-sage-400"
                />
                {opt.label}
              </label>
            ))}
          </div>
          <div className="flex flex-wrap gap-2">
            {availableTags.slice(0, 6).map(tag => (
              <label key={tag} className="flex items-center gap-2 px-3 py-2 rounded-full text-sm font-medium bg-linen-100 border border-linen-200 text-charcoal-500 hover:bg-linen-200 cursor-pointer">
                <input
                  type="checkbox"
                  checked={activeFilters.includes(tag)}
                  onChange={() => setActiveFilters(activeFilters.includes(tag) ? activeFilters.filter(x => x !== tag) : [...activeFilters, tag])}
                  className="w-4 h-4 text-sage-500 focus:ring-sage-400"
                />
                {tag}
              </label>
            ))}
            {availableTags.length > 6 && (
              <button
                onClick={handleTagSearch}
                className="flex items-center gap-2 px-3 py-2 rounded-full text-sm font-medium bg-linen-100 border border-linen-200 text-charcoal-500 hover:bg-linen-200 cursor-pointer transition"
              >
                <EllipsisHorizontalIcon className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>
        <button
          className="mt-6 w-full py-3 rounded-full font-semibold bg-sage-400 text-white shadow-soft hover:bg-sage-500 transition"
          onClick={onClose}
        >
          Apply Filters
        </button>
      </div>

      <TagSearchModal
        isOpen={showTagSearch}
        onClose={() => setShowTagSearch(false)}
        availableTags={availableTags}
        selectedTags={activeFilters.filter(filter => availableTags.includes(filter))}
        onTagsChange={handleTagsChange}
      />
    </>,
    document.body
  )
}

export default FilterSortDropdown 