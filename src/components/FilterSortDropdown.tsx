import React, { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { EllipsisHorizontalIcon } from '@heroicons/react/24/outline'
import TagSearchModal from './TagSearchModal'
import { useFilters } from '../contexts/FiltersContext'

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
  selectedTags?: string[]
  setSelectedTags?: (tags: string[]) => void
  show: boolean
  onClose: () => void
  anchorRect?: DOMRect | null
  onLocationSelect?: (location: Location) => void
  hubFilter?: string | null
  onApplyFilters?: () => void
  onOpenAdvanced?: () => void
  distanceKm?: number
  setDistanceKm?: (km: number) => void
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
  selectedTags = [],
  setSelectedTags,
  show,
  onClose,
  anchorRect,
  onLocationSelect,
  hubFilter,
  onApplyFilters,
  onOpenAdvanced,
  distanceKm,
  setDistanceKm
}) => {
  const [showTagSearch, setShowTagSearch] = useState(false)
  const [tagQuery, setTagQuery] = useState('')
  const { resetFilters } = useFilters()
  const [mounted, setMounted] = useState(false)

  useEffect(() => { setMounted(true) }, [])

  if (!show) return null

  // Center the dropdown on the page to avoid cutting off
  const panelStyle = {
    position: 'fixed' as const,
    top: '50%',
    left: '50%',
    transform: 'translate(-50%, -50%)',
    width: PANEL_WIDTH,
    zIndex: 99999
  }



  return createPortal(
    <>
      <div className={`fixed inset-0 z-[9999] bg-black/10 transition-opacity duration-200 ${mounted ? 'opacity-100' : 'opacity-0'}`} onClick={onClose}></div>
      <div style={panelStyle} className={`rounded-2xl shadow-cozy border border-linen-200 bg-white p-6 transition-all duration-200 ${mounted ? 'opacity-100 translate-y-0 scale-100' : 'opacity-0 translate-y-2 scale-95'}`}>
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
                  onChange={() => setSortBy(opt.key)}
                  className="w-5 h-5 text-sage-500 focus:ring-sage-400"
                />
                <span className="font-medium text-charcoal-600">{opt.label}</span>
              </label>
            ))}
          </div>
        </div>
        <div>
          <div className="font-serif font-semibold mb-4 text-lg text-charcoal-700">Filter by</div>
          
          {/* Hub Filter Display */}
          {hubFilter && (
            <div className="mb-4 p-3 bg-sage-50 border border-sage-200 rounded-lg">
              <div className="text-sm font-medium text-sage-700 mb-1">Include:</div>
              <div className="text-sm text-charcoal-600">{hubFilter}</div>
            </div>
          )}
          
          <div className="flex flex-wrap gap-2 mb-4">
            {filterOptions.map(opt => (
              <label key={opt.key} className="flex items-center gap-2 px-3 py-2 rounded-full text-sm font-medium bg-sage-50 border border-sage-100 text-sage-700 hover:bg-sage-100 cursor-pointer">
                <input
                  type="checkbox"
                  checked={activeFilters.includes(opt.key)}
                  onChange={() => {
                    const newFilters = activeFilters.includes(opt.key)
                      ? activeFilters.filter(f => f !== opt.key)
                      : [...activeFilters, opt.key];
                    setActiveFilters(newFilters);
                  }}
                  className="w-4 h-4 text-sage-500 focus:ring-sage-400"
                />
                {opt.label}
              </label>
            ))}
          </div>
          {/* Distance filter (optional) */}
          {typeof distanceKm === 'number' && setDistanceKm && (
            <div className="mb-4">
              <div className="flex items-center justify-between mb-2">
                <div className="text-sm font-medium text-charcoal-700">Max distance</div>
                <div className="text-sm text-charcoal-600">{Math.round(distanceKm)} km</div>
              </div>
              <input
                type="range"
                min={5}
                max={200}
                step={5}
                value={distanceKm}
                onChange={(e)=> setDistanceKm(parseInt(e.target.value,10))}
                className="w-full"
              />
              <div className="flex justify-between text-xs text-charcoal-500 mt-1">
                <span>5</span>
                <span>200</span>
              </div>
            </div>
          )}
          {/* Inline tag search */}
          <div className="mb-3">
            <input
              type="text"
              value={tagQuery}
              onChange={(e) => setTagQuery(e.target.value)}
              placeholder="Search tags..."
              className="w-full px-3 py-2 rounded-lg border border-linen-200 bg-white text-charcoal-600 focus:outline-none focus:ring-2 focus:ring-sage-200"
            />
          </div>
          <div className="flex flex-wrap gap-2">
            {[...selectedTags, ...availableTags.filter(t => !selectedTags.includes(t))]
              .filter(t => t.toLowerCase().includes(tagQuery.toLowerCase()))
              .slice(0, 12)
              .map(tag => (
              <label key={tag} className="flex items-center gap-2 px-3 py-2 rounded-full text-sm font-medium bg-linen-100 border border-linen-200 text-charcoal-500 hover:bg-linen-200 cursor-pointer">
                <input
                  type="checkbox"
                  checked={selectedTags.includes(tag)}
                  onChange={() => {
                    if (!setSelectedTags) return
                    const newTags = selectedTags.includes(tag)
                      ? selectedTags.filter(t => t !== tag)
                      : [...selectedTags, tag]
                    setSelectedTags(newTags)
                  }}
                  className="w-4 h-4 text-sage-500 focus:ring-sage-400"
                />
                {tag}
              </label>
            ))}
            {availableTags.filter(t => t.toLowerCase().includes(tagQuery.toLowerCase())).length > 12 && (
              <button
                onClick={() => setShowTagSearch(true)}
                className="flex items-center gap-2 px-3 py-2 rounded-full text-sm font-medium bg-linen-100 border border-linen-200 text-charcoal-500 hover:bg-linen-200 cursor-pointer transition"
              >
                <EllipsisHorizontalIcon className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>
        {onOpenAdvanced && (
          <div className="mt-4 mb-2 flex justify-end">
            <button
              className="px-3 py-1.5 rounded-full text-sm font-semibold bg-white text-sage-700 border border-sage-200 shadow-soft hover:bg-sage-50 transition"
              onClick={() => { onOpenAdvanced(); onClose(); }}
            >
              Advanced filters
            </button>
          </div>
        )}
        <div className="mt-4 flex gap-2">
          <button
            className="flex-1 py-3 rounded-full font-semibold bg-sage-400 text-white shadow-soft hover:bg-sage-500 transition"
            onClick={() => {
              if (onApplyFilters) {
                onApplyFilters()
              }
              onClose()
            }}
          >
            Apply Filters
          </button>
          <button
            className="px-4 py-3 rounded-full font-semibold bg-linen-100 text-charcoal-700 border border-linen-200 hover:bg-linen-200 transition"
            onClick={() => {
              // Reset both general and advanced filters
              resetFilters()
              setActiveFilters([])
              if (setSelectedTags) setSelectedTags([])
              setTagQuery('')
            }}
          >
            Reset
          </button>
        </div>
      </div>

      <TagSearchModal
        isOpen={showTagSearch}
        onClose={() => setShowTagSearch(false)}
        availableTags={availableTags}
        selectedTags={selectedTags}
        onTagsChange={(newTags) => {
          if (setSelectedTags) setSelectedTags(newTags)
        }}
      />
    </>,
    document.body
  )
}

export default FilterSortDropdown 