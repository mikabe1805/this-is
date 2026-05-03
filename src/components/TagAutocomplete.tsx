import React, { useState, useEffect } from 'react'
import { firebaseDataService } from '../services/firebaseDataService'

interface TagAutocompleteProps {
  value: string
  onChange: (value: string) => void
  onAdd: () => void
  placeholder?: string
  maxTags?: number
  currentTags: string[]
  availableTags: string[]
  className?: string
  disabled?: boolean
  showPopularTags?: boolean
  popularLabel?: string
  persistTo?: 'tags' | 'userTags'
}

export default function TagAutocomplete({
  value,
  onChange,
  onAdd,
  placeholder = "Add a tag...",
  maxTags = 5,
  currentTags,
  availableTags,
  className = "",
  disabled = false,
  showPopularTags = true,
  popularLabel = 'Popular tags',
  persistTo = 'tags'
}: TagAutocompleteProps) {
  const [showDropdown, setShowDropdown] = useState(false)
  const [filteredTags, setFilteredTags] = useState<string[]>([])

  useEffect(() => {
    if (value.trim() === '') {
      setFilteredTags([])
      setShowDropdown(false)
    } else {
      const currentLower = currentTags.map(t => t.toLowerCase())
      const filtered = availableTags.filter(tag =>
        tag.toLowerCase().includes(value.toLowerCase()) &&
        !currentLower.includes(tag.toLowerCase())
      )
      setFilteredTags(filtered)
      setShowDropdown(filtered.length > 0)
    }
  }, [value, availableTags, currentTags])

  const persistTag = async (tag: string) => {
    try {
      if (persistTo === 'userTags') {
        await firebaseDataService.addUserTag(tag)
      } else {
        await firebaseDataService.addTag(tag)
      }
    } catch (error) {
      console.error('Error saving tag:', error)
    }
  }

  const handleSelectTag = async (tag: string) => {
    const normalized = tag.toLowerCase().trim()
    onChange(normalized)
    setShowDropdown(false)
    const lowerAvailable = availableTags.map(t => t.toLowerCase())
    if (!lowerAvailable.includes(normalized)) {
      await persistTag(normalized)
    }
  }

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      handleAddTag()
    }
  }

  const handleAddTag = async () => {
    const normalized = value.toLowerCase().trim()
    const currentLower = currentTags.map(t => t.toLowerCase())
    if (normalized && !currentLower.includes(normalized) && currentTags.length < maxTags) {
      onAdd()
      const lowerAvailable = availableTags.map(t => t.toLowerCase())
      if (!lowerAvailable.includes(normalized)) {
        await persistTag(normalized)
      }
    }
  }

  const handleFocus = () => {
    if (value.trim() && filteredTags.length > 0) {
      setShowDropdown(true)
    }
  }

  const handleBlur = () => {
    setTimeout(() => setShowDropdown(false), 150)
  }

  const shouldShowPopular = showPopularTags && currentTags.length === 0

  return (
    <div className="relative">
      <div className="flex gap-2">
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onFocus={handleFocus}
          onBlur={handleBlur}
          onKeyPress={handleKeyPress}
          placeholder={currentTags.length >= maxTags ? `Maximum ${maxTags} tags` : placeholder}
          className={`flex-1 px-4 py-2 border border-linen-200 rounded-xl bg-linen-50 text-charcoal-600 focus:outline-none focus:ring-2 focus:ring-sage-200 disabled:bg-gray-100 ${className}`}
          disabled={disabled || currentTags.length >= maxTags}
        />
        <button
          type="button"
          onClick={handleAddTag}
          className="px-4 py-2 bg-sage-400 text-white rounded-xl hover:bg-sage-500 transition disabled:bg-gray-300 disabled:cursor-not-allowed"
          disabled={disabled || currentTags.length >= maxTags || !value.trim()}
        >
          Add
        </button>
      </div>
      
      {showDropdown && filteredTags.length > 0 && (
        <div className="absolute z-10 w-full mt-1 bg-white border border-linen-200 rounded-xl shadow-lg">
          {filteredTags.map((tag) => (
            <button
              key={tag}
              type="button"
              onClick={() => handleSelectTag(tag)}
              className="w-full px-4 py-2 text-left text-charcoal-600 hover:bg-linen-50"
            >
              {tag}
            </button>
          ))}
        </div>
      )}
      
      {shouldShowPopular && (
        <div className="mt-2">
          <p className="text-xs text-charcoal-500 mb-2">{popularLabel}:</p>
          <div className="flex flex-wrap gap-1">
            {availableTags.slice(0, 6).map((tag) => (
              <button
                key={tag}
                type="button"
                onClick={() => !currentTags.includes(tag) && currentTags.length < maxTags && handleSelectTag(tag)}
                disabled={currentTags.includes(tag) || currentTags.length >= maxTags}
                className={`px-2 py-1 rounded-full text-xs transition ${
                  currentTags.includes(tag) || currentTags.length >= maxTags
                    ? 'bg-sage-200 text-sage-600 cursor-not-allowed opacity-50'
                    : 'bg-linen-100 text-charcoal-600 hover:bg-sage-100'
                }`}
              >
                #{tag}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
} 