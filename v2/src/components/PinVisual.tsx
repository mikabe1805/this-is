/**
 * The card/closeup visual. Layer order, bottom-up:
 *   1. The PLATE — an art-directed block built from the stored dominant hex:
 *      lit-from-upper-left gradient (the picture-light), film grain, and a
 *      quiet Fraunces monogram of the place's initial. This is the loading
 *      state AND the no-photo state — never a spinner, never a flat box.
 *   2. A photo, when one is allowed: the user's own (pin cover) or a fresh
 *      attributed Google photo (closeup only). Fades in over the plate under
 *      the one photographic grade.
 */
import { useState } from 'react'

interface PinVisualProps {
  hex: string
  photoSrc?: string
  attribution?: string
  attributionUri?: string
  alt: string
  className?: string
}

function plateVariant(label: string): number {
  let hash = 2166136261
  for (const character of label.trim().toLowerCase()) {
    hash ^= character.charCodeAt(0)
    hash = Math.imul(hash, 16777619)
  }
  return (hash >>> 0) % 5
}

export function PinVisual({ hex, photoSrc, attribution, attributionUri, alt, className = '' }: PinVisualProps) {
  const [loaded, setLoaded] = useState(false)
  const [failed, setFailed] = useState(false)
  const showPhoto = photoSrc && !failed
  const initial = (alt.trim()[0] ?? '·').toUpperCase()
  const variant = plateVariant(alt)

  return (
    <div
      className={`pin-visual plate-v${variant} ${className}`}
      style={{ '--dominant': hex } as React.CSSProperties}
    >
      {!(showPhoto && loaded) && (
        <>
          <span className="plate-geometry" aria-hidden />
          <span className="plate-monogram" aria-hidden>{initial}</span>
        </>
      )}
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
      {showPhoto && loaded && attributionUri && (
        <a
          className="photo-credit"
          href={attributionUri}
          target="_blank"
          rel="noreferrer"
          aria-label={`${attribution ? `Photo by ${attribution}` : 'Photo'}; open source in Google Maps`}
          onClick={event => event.stopPropagation()}
        >
          {attribution ? `${attribution} · ` : ''}Google Maps ↗
        </a>
      )}
    </div>
  )
}
