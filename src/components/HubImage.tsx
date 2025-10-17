import React, { useMemo, useState } from 'react'
import { posterPathFor } from '../utils/posterMapping'

type PlaceLike = {
  name?: string
  photos?: { name: string }[]
  primaryType?: string
}

type Props = {
  photos?: { name: string }[]
  primaryType?: string
  types?: string[]
  place?: PlaceLike // compatibility path
  className?: string
  aspect?: string // e.g. aspect-[4/3]
  maxWidthPx?: number // default 480; 960 on detail page
  alt?: string
  load?: boolean // default false to minimize costs
  // legacy compatibility
  loadStrategy?: 'fallback' | 'load'
}

// Deprecated local mapping is replaced by posterMapping helpers

export default function HubImage({
  photos,
  primaryType,
  types,
  place,
  className = 'rounded-xl2 shadow-soft',
  aspect = 'aspect-[4/3]',
  maxWidthPx = 480,
  alt = '',
  load = false,
  loadStrategy,
}: Props) {
  const [loaded, setLoaded] = useState(false)
  const [failed, setFailed] = useState(false)

  const doLoad = loadStrategy ? loadStrategy === 'load' : load

  const src = useMemo(() => {
    if (!doLoad) return ''
    const name = (photos || place?.photos)?.[0]?.name
    const key = (import.meta as any).env?.VITE_GOOGLE_MAPS_API_KEY || (import.meta as any).env?.VITE_PLACES_NEW_KEY
    if (!name || !key) return ''
    return `https://places.googleapis.com/v1/${name}/media?maxWidthPx=${maxWidthPx}&key=${key}`
  }, [photos?.[0]?.name, place?.photos?.[0]?.name, maxWidthPx, doLoad])

  const fallback = useMemo(() => {
    const t = types || (place as any)?.types
    return posterPathFor(primaryType || place?.primaryType, Array.isArray(t) ? t : [])
  }, [types, primaryType, place?.primaryType, (place as any)?.types])

  return (
    <figure className={`relative overflow-hidden poster-grade poster-noise ${aspect} ${className}`}>
      <img
        src={fallback}
        alt={alt || place?.name || ''}
        className='absolute inset-0 w-full h-full object-cover'
        loading='lazy'
        onError={(e) => { (e.currentTarget as HTMLImageElement).src = '/assets/leaf.png' }}
      />
      {src && !failed && (
        <img
          src={src}
          alt={alt || place?.name || ''}
          className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-300 ${loaded ? 'opacity-100' : 'opacity-0'}`}
          loading='lazy'
          onLoad={() => setLoaded(true)}
          onError={() => setFailed(true)}
        />
      )}
    </figure>
  )
}
