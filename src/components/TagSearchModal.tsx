import React, { useState } from 'react'
import { createPortal } from 'react-dom'
import { XMarkIcon, MagnifyingGlassIcon, CheckIcon } from '@heroicons/react/24/outline'

interface TagSearchModalProps {
  isOpen: boolean
  onClose: () => void
  availableTags: string[]
  selectedTags: string[]
  onTagsChange: (tags: string[]) => void
}

const TagSearchModal: React.FC<TagSearchModalProps> = ({
  isOpen,
  onClose,
  availableTags,
  selectedTags,
  onTagsChange
}) => {
  const [searchQuery, setSearchQuery] = useState('')
  const [localSelectedTags, setLocalSelectedTags] = useState<string[]>(selectedTags)

  if (!isOpen) return null

  const filteredTags = availableTags.filter(tag =>
    tag.toLowerCase().includes(searchQuery.toLowerCase())
  )

  const handleTagToggle = (tag: string) => {
    setLocalSelectedTags(prev => 
      prev.includes(tag) 
        ? prev.filter(t => t !== tag)
        : [...prev, tag]
    )
  }

  const handleApply = () => {
    onTagsChange(localSelectedTags)
    onClose()
  }

  const handleCancel = () => {
    setLocalSelectedTags(selectedTags)
    onClose()
  }

  return createPortal(
    <div className="fixed inset-0 z-[99999] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="relative w-full max-w-md bg-white rounded-3xl shadow-botanical border border-linen-200 overflow-hidden">
        {/* Header */}
        <div className="p-6 border-b border-linen-200 bg-linen-50 flex items-center justify-between">
          <h2 className="text-xl font-serif font-semibold text-charcoal-700">Search Tags</h2>
          <button
            onClick={handleCancel}
            className="w-8 h-8 bg-white rounded-full flex items-center justify-center shadow-soft hover:shadow-botanical transition"
          >
            <XMarkIcon className="w-5 h-5 text-charcoal-600" />
          </button>
        </div>

        {/* Search Input */}
        <div className="p-6 border-b border-linen-200">
          <div className="relative">
            <MagnifyingGlassIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-sage-400" />
            <input
              type="text"
              placeholder="Search tags..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-3 bg-linen-50 border border-linen-200 rounded-xl text-charcoal-600 focus:outline-none focus:ring-2 focus:ring-sage-200 focus:border-sage-300"
            />
          </div>
        </div>

        {/* Tags List */}
        <div className="p-6 max-h-96 overflow-y-auto">
          {filteredTags.length > 0 ? (
            <div className="space-y-2">
              {filteredTags.map(tag => (
                <label
                  key={tag}
                  className="flex items-center gap-3 p-3 rounded-xl cursor-pointer border border-transparent hover:border-sage-200 hover:bg-sage-50 transition"
                >
                  <input
                    type="checkbox"
                    checked={localSelectedTags.includes(tag)}
                    onChange={() => handleTagToggle(tag)}
                    className="w-5 h-5 text-sage-500 focus:ring-sage-400 rounded"
                  />
                  <span className="font-medium text-charcoal-600 flex-1">#{tag}</span>
                  {localSelectedTags.includes(tag) && (
                    <CheckIcon className="w-5 h-5 text-sage-500" />
                  )}
                </label>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-charcoal-500">
              <p>No tags found matching "{searchQuery}"</p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-linen-200 bg-linen-50 flex gap-3">
          <button
            onClick={handleCancel}
            className="flex-1 py-3 px-4 rounded-xl font-medium text-charcoal-600 bg-white border border-linen-200 hover:bg-linen-100 transition"
          >
            Cancel
          </button>
          <button
            onClick={handleApply}
            className="flex-1 py-3 px-4 rounded-xl font-semibold bg-sage-400 text-white shadow-soft hover:bg-sage-500 transition"
          >
            Apply ({localSelectedTags.length})
          </button>
        </div>
      </div>
    </div>,
    document.body
  )
}

export default TagSearchModal 