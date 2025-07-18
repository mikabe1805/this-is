import { useState } from 'react'
import { ChevronLeftIcon, ChevronRightIcon } from '@heroicons/react/24/outline'

interface ImageCarouselProps {
  images: string[]
  className?: string
  showArrows?: boolean
  autoPlay?: boolean
  interval?: number
}

const ImageCarousel = ({ 
  images, 
  className = "", 
  showArrows = true, 
  autoPlay = false, 
  interval = 3000 
}: ImageCarouselProps) => {
  const [currentIndex, setCurrentIndex] = useState(0)

  const nextImage = () => {
    setCurrentIndex((prev) => (prev + 1) % images.length)
  }

  const prevImage = () => {
    setCurrentIndex((prev) => (prev - 1 + images.length) % images.length)
  }

  const goToImage = (index: number) => {
    setCurrentIndex(index)
  }

  if (images.length === 0) return null

  return (
    <div className={`relative overflow-hidden rounded-xl ${className}`}>
      {/* Main Image */}
      <div className="relative aspect-square">
        <img
          src={images[currentIndex]}
          alt={`Image ${currentIndex + 1}`}
          className="w-full h-full object-cover"
        />
        
        {/* Navigation Arrows */}
        {showArrows && images.length > 1 && (
          <>
            <button
              onClick={prevImage}
              className="absolute left-2 top-1/2 transform -translate-y-1/2 w-10 h-10 bg-black/30 backdrop-blur-sm text-white rounded-full flex items-center justify-center hover:bg-black/50 transition-all duration-200 z-20"
              aria-label="Previous image"
            >
              <ChevronLeftIcon className="w-6 h-6" />
            </button>
            <button
              onClick={nextImage}
              className="absolute right-2 top-1/2 transform -translate-y-1/2 w-10 h-10 bg-black/30 backdrop-blur-sm text-white rounded-full flex items-center justify-center hover:bg-black/50 transition-all duration-200 z-20"
              aria-label="Next image"
            >
              <ChevronRightIcon className="w-6 h-6" />
            </button>
          </>
        )}

        {/* Image Counter */}
        {images.length > 1 && (
          <div className="absolute top-2 right-2 bg-black/50 backdrop-blur-sm text-white text-xs px-2 py-1 rounded-full z-20">
            {currentIndex + 1} / {images.length}
          </div>
        )}
      </div>

      {/* Dots Indicator */}
      {images.length > 1 && (
        <div className="absolute bottom-2 left-1/2 transform -translate-x-1/2 flex gap-1 z-20">
          {images.map((_, index) => (
            <button
              key={index}
              onClick={() => goToImage(index)}
              className={`w-2 h-2 rounded-full transition-all duration-200 ${
                index === currentIndex 
                  ? 'bg-white' 
                  : 'bg-white/50 hover:bg-white/75'
              }`}
              aria-label={`Go to image ${index + 1}`}
            />
          ))}
        </div>
      )}
    </div>
  )
}

export default ImageCarousel 