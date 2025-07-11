import { useState } from 'react'

interface Tag {
  name: string
  count: number
  isSelected?: boolean
}

interface TagCloudProps {
  tags: Tag[]
  onTagClick?: (tag: string) => void
  maxTags?: number
  showCounts?: boolean
  variant?: 'default' | 'compact' | 'filter'
}

const TagCloud = ({ 
  tags, 
  onTagClick, 
  maxTags = 10, 
  showCounts = false, 
  variant = 'default' 
}: TagCloudProps) => {
  const [selectedTags, setSelectedTags] = useState<string[]>([])

  // Sort by count and limit
  const sortedTags = [...tags]
    .sort((a, b) => b.count - a.count)
    .slice(0, maxTags)

  // Calculate opacity based on popularity
  const maxCount = Math.max(...sortedTags.map(t => t.count))
  const minCount = Math.min(...sortedTags.map(t => t.count))

  const getOpacity = (count: number) => {
    if (maxCount === minCount) return 0.8
    return 0.3 + ((count - minCount) / (maxCount - minCount)) * 0.7
  }

  const handleTagClick = (tagName: string) => {
    if (variant === 'filter') {
      setSelectedTags(prev => 
        prev.includes(tagName) 
          ? prev.filter(t => t !== tagName)
          : [...prev, tagName]
      )
    }
    onTagClick?.(tagName)
  }

  const getTagStyles = (tag: Tag) => {
    const baseStyles = "transition-all duration-300 cursor-pointer font-medium"
    const opacity = getOpacity(tag.count)
    
    if (variant === 'filter') {
      const isSelected = selectedTags.includes(tag.name)
      return `${baseStyles} px-3 py-1.5 rounded-full text-sm border-2 ${
        isSelected
          ? 'bg-gradient-to-r from-warm-500 to-warm-400 text-white border-warm-500 shadow-warm-200'
          : 'bg-white/80 text-earth-600 border-linen-200 hover:border-sage-300 hover:bg-linen-50'
      }`
    }

    if (variant === 'compact') {
      return `${baseStyles} px-2 py-1 rounded-lg text-xs bg-linen-100 text-sage-700 hover:bg-linen-200`
    }

    // Default variant
    return `${baseStyles} px-3 py-1.5 rounded-full text-sm bg-gradient-to-r from-warm-100 to-cream-100 text-warm-600 hover:from-warm-200 hover:to-cream-200 border border-warm-200 hover:border-warm-300`
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        {sortedTags.map((tag) => (
          <button
            key={tag.name}
            onClick={() => handleTagClick(tag.name)}
            className={getTagStyles(tag)}
            style={{ opacity: variant === 'default' ? getOpacity(tag.count) : undefined }}
          >
            <span className="font-semibold">#{tag.name}</span>
            {showCounts && (
              <span className="ml-1 text-xs opacity-70">({tag.count})</span>
            )}
          </button>
        ))}
      </div>
      
      {variant === 'filter' && selectedTags.length > 0 && (
        <div className="flex items-center gap-2 text-sm text-earth-600">
          <span>Filtering by:</span>
          <div className="flex flex-wrap gap-1">
            {selectedTags.map(tag => (
              <span key={tag} className="px-2 py-0.5 bg-linen-100 text-sage-700 rounded-full text-xs">
                #{tag}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

export default TagCloud 