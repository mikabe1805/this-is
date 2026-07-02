/**
 * The card/closeup visual: the dominant-hex block is the base layer and the
 * loading state; a photo (Google — fresh + attributed — or the user's own)
 * fades in over it under the one photographic grade. The grid never shows a
 * spinner or a white box.
 */
import { useState } from 'react'

interface PinVisualProps {
  hex: string
  photoSrc?: string
  attribution?: string
  alt: string
  className?: string
}

export function PinVisual({ hex, photoSrc, attribution, alt, className = '' }: PinVisualProps) {
  const [loaded, setLoaded] = useState(false)
  const [failed, setFailed] = useState(false)
  const showPhoto = photoSrc && !failed

  return (
    <div
      className={`pin-visual ${className}`}
      style={{ '--dominant': hex } as React.CSSProperties}
    >
      {showPhoto && (
        <img
          src={photoSrc}
          alt={alt}
          loading="lazy"
          className={`pin-photo photo-grade${loaded ? ' is-loaded' : ''}`}
          onLoad={() => setLoaded(true)}
          onError={() => setFailed(true)}
        />
      )}
      {showPhoto && loaded && attribution && (
        <span className="photo-credit eyebrow">PHOTO: {attribution}</span>
      )}
    </div>
  )
}
