import React, { useState, useRef, useEffect } from 'react'

interface ImageCarouselProps {
  images: string[]
  className?: string
  autoPlay?: boolean
  interval?: number
  currentIndex?: number
  onIndexChange?: (index: number) => void
  onClick?: (e: React.MouseEvent | React.TouchEvent) => void
}

const ImageCarousel: React.FC<ImageCarouselProps> = ({
  images,
  className = '',
  autoPlay = false,
  interval = 3000,
  currentIndex: externalCurrentIndex,
  onIndexChange,
  onClick
}) => {
  const [currentIndex, setCurrentIndex] = useState(externalCurrentIndex || 0)
  const touchStartX = useRef(0)
  const touchEndX = useRef(0)
  const touchStartY = useRef(0)
  const touchEndY = useRef(0)
  const containerRef = useRef<HTMLDivElement>(null)
  
  const minSwipeDistance = 30

  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.targetTouches[0].clientX
    touchStartY.current = e.targetTouches[0].clientY
    touchEndX.current = e.targetTouches[0].clientX // Reset on new touch
    touchEndY.current = e.targetTouches[0].clientY
  }

  const handleTouchMove = (e: React.TouchEvent) => {
    touchEndX.current = e.targetTouches[0].clientX
    touchEndY.current = e.targetTouches[0].clientY
  }

  const handleTouchEnd = (e: React.TouchEvent) => {
    const swipeDistance = touchStartX.current - touchEndX.current
    const verticalDistance = Math.abs((touchStartY.current || 0) - (touchEndY.current || 0))

    // If it's more of a vertical swipe, let the parent handle it
    if (verticalDistance > Math.abs(swipeDistance)) {
      return // Let the parent handle vertical swipes
    }

    if (Math.abs(swipeDistance) < minSwipeDistance) {
      if (onClick) {
        onClick(e)
      }
      return
    }

    // Only handle horizontal swipes
    e.stopPropagation()
    
    if (swipeDistance > 0) {
      // Swipe left
      if (currentIndex < images.length - 1) {
        const newIndex = currentIndex + 1
        setCurrentIndex(newIndex)
        if (onIndexChange) onIndexChange(newIndex)
      }
    } else {
      // Swipe right
      if (currentIndex > 0) {
        const newIndex = currentIndex - 1
        setCurrentIndex(newIndex)
        if (onIndexChange) onIndexChange(newIndex)
      }
    }
  }
  
  // Sync with external state
  useEffect(() => {
    if (externalCurrentIndex !== undefined && externalCurrentIndex !== currentIndex) {
      setCurrentIndex(externalCurrentIndex)
    }
  }, [externalCurrentIndex])

  // Auto-play functionality
  useEffect(() => {
    if (!autoPlay || images.length <= 1) return

    const timer = setInterval(() => {
      const newIndex = (currentIndex + 1) % images.length
      setCurrentIndex(newIndex)
      if (onIndexChange) onIndexChange(newIndex)
    }, interval)

    return () => clearInterval(timer)
  }, [autoPlay, interval, images.length, currentIndex, onIndexChange])

  return (
    <div
      ref={containerRef}
      className={`relative w-full h-full overflow-hidden ${className}`}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      {/* Sliding container */}
      <div
        className="flex h-full transition-transform duration-300 ease-in-out"
        style={{ transform: `translateX(-${currentIndex * 100}%)` }}
      >
        {images.map((src, idx) => (
          <div key={idx} className="relative w-full h-full flex-shrink-0">
                                    <img
                          src={src}
                          alt={`Image ${idx + 1}`}
                          className="w-full h-full object-cover"
                          style={{ 
                objectFit: 'cover', 
                width: '100%', 
                height: '100%', 
                minHeight: '100vh',
                backfaceVisibility: 'hidden',
                transform: 'translateZ(0)'
              }}
                          draggable={false}
                        />
          </div>
        ))}
      </div>

      {/* Dots Indicator */}
                        {images.length > 1 && (
                    <div className="absolute bottom-20 left-1/2 transform -translate-x-1/2 flex gap-2">
                      {images.map((_, idx) => (
                        <div
                          key={idx}
                          className={`w-2 h-2 rounded-full transition-all duration-300 ${
                            idx === currentIndex
                              ? 'bg-white scale-110'
                              : 'bg-white/50'
                          }`}
                        />
                      ))}
                    </div>
                  )}
    </div>
  )
}

export default ImageCarousel 