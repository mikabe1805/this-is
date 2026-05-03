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
          className={`flex-1 h-10 px-3.5 rounded-full border border-edge bg-card text-[13px] text-ink placeholder:text-ink-mute outline-none focus:border-ink/40 disabled:opacity-50 ${className}`}
          disabled={disabled || currentTags.length >= maxTags}
        />
        <button
          type="button"
          onClick={handleAddTag}
          className="btn-secondary h-10 px-4 label-eyebrow disabled:opacity-50 disabled:cursor-not-allowed"
          disabled={disabled || currentTags.length >= maxTags || !value.trim()}
        >
          Add
        </button>
      </div>

      {showDropdown && filteredTags.length > 0 && (
        <div className="absolute z-10 w-full mt-1.5 rounded-xl bg-card border border-edge shadow-lg overflow-hidden">
          {filteredTags.map((tag) => (
            <button
              key={tag}
              type="button"
              onClick={() => handleSelectTag(tag)}
              className="w-full px-4 py-2.5 text-left text-[13px] text-ink hover:bg-paper-deep transition-colors border-b border-edge last:border-b-0"
            >
              #{tag}
            </button>
          ))}
        </div>
      )}

      {shouldShowPopular && (
        <div className="mt-3">
          <p className="font-mono text-[10px] tracking-[0.10em] uppercase text-ink-mute mb-2">{popularLabel}</p>
          <div className="flex flex-wrap gap-1.5">
            {availableTags.slice(0, 8).map((tag) => {
              const taken = currentTags.includes(tag) || currentTags.length >= maxTags
              return (
                <button
                  key={tag}
                  type="button"
                  onClick={() => !taken && handleSelectTag(tag)}
                  disabled={taken}
                  className={`h-7 px-2.5 rounded-full text-[12px] font-medium border transition-colors ${
                    taken
                      ? 'bg-paper-deep text-ink-faint border-edge cursor-not-allowed'
                      : 'bg-card text-ink-soft border-edge hover:border-ink/40 hover:text-ink'
                  }`}
                >
                  #{tag}
                </button>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
} 