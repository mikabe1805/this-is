import { useMemo, useState } from 'react'
import PlacePoster from './ui/PlacePoster'
import { PLACES_PHOTOS_ENABLED } from '../lib/flags'

type PlaceLike = {
  name?: string
  photos?: { name: string }[]
  primaryType?: string
  mainImage?: string
  hubImage?: string
  coverImage?: string
}

type Props = {
  photos?: { name: string }[]
  primaryType?: string
  types?: string[]
  place?: PlaceLike
  /** User-uploaded image (mainImage/hubImage/coverImage). Wins over Google photo when present. */
  userImage?: string
  className?: string
  aspect?: string
  maxWidthPx?: number
  alt?: string
  load?: boolean
  loadStrategy?: 'fallback' | 'load'
}

export default function HubImage({
  photos,
  primaryType,
  types,
  place,
  userImage,
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

  // Image priority:
  //   1. User-uploaded photo (mainImage/hubImage/coverImage on the place doc)
  //   2. Google Places photo (only when load is enabled)
  //   3. Risograph poster fallback (PlacePoster behind the figure)
  // The user-uploaded URL is treated as an absolute URL — never run through
  // the Places photo media endpoint.
  const resolvedUserImage = userImage || place?.mainImage || place?.hubImage || place?.coverImage || ''

  const src = useMemo(() => {
    if (resolvedUserImage) return resolvedUserImage
    if (!doLoad) return ''
    // Respect the global photos kill-switch — without this, HubImage loaded
    // Google photos (billing the Photo SKU) whenever the Places key existed,
    // even with VITE_PLACES_PHOTOS_ENABLED=false. Now the flag is authoritative
    // everywhere HubImage is used (feeds, hub/list modals, ListView).
    if (!PLACES_PHOTOS_ENABLED) return ''
    const name = (photos || place?.photos)?.[0]?.name
    // Photos bill on the dedicated Places key only — never the Maps key (that
    // routed Photo SKU charges outside the photo-budget controls). No key ⇒
    // fall through to the poster.
    const key = (import.meta as any).env?.VITE_PLACES_NEW_KEY
    if (!name || !key) return ''
    return `https://places.googleapis.com/v1/${name}/media?maxWidthPx=${maxWidthPx}&key=${key}`
  }, [resolvedUserImage, photos?.[0]?.name, place?.photos?.[0]?.name, maxWidthPx, doLoad])

  const resolvedTypes = (types || (place as any)?.types || []) as string[]
  const resolvedName = alt || place?.name || ''

  return (
    <figure className={`relative overflow-hidden ${aspect} ${className}`}>
      <PlacePoster
        primaryType={primaryType || place?.primaryType}
        types={resolvedTypes}
        name={resolvedName}
        className="absolute inset-0 w-full h-full"
      />
      {src && !failed && (
        <img
          src={src}
          alt={resolvedName}
          className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-300 ${loaded ? 'opacity-100' : 'opacity-0'}`}
          loading='lazy'
          onLoad={() => setLoaded(true)}
          onError={() => setFailed(true)}
        />
      )}
    </figure>
  )
}
