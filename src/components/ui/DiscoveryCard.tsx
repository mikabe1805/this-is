import { BookmarkIcon, HandThumbDownIcon } from '@heroicons/react/24/outline'
import { BookmarkIcon as BookmarkIconSolid } from '@heroicons/react/24/solid'
import HubImage from '../HubImage'
import PlacePoster from './PlacePoster'
import { pickTheme } from './categoryTheme'

export interface DiscoveryCardItem {
  id: string
  kind: 'place' | 'list' | 'user'
  title: string
  subtitle?: string
  primaryType?: string
  types?: string[]
  photos?: { name: string }[]
  imageUrl?: string
  distanceKm?: number
  saved?: boolean
  // Optional social-density signal — drives the saturated chip on the card.
  savedCount?: number
  friendCount?: number
  postCount?: number
  /** Why this was recommended, e.g. "Because you love coffee". */
  reason?: string
}

interface DiscoveryCardProps {
  item: DiscoveryCardItem
  onOpen: () => void
  onSave?: () => void
  /** "Not interested" — when provided, shows a thumbs-down that tunes the feed. */
  onDismiss?: () => void
  loadImage?: boolean
  variant?: 'standard' | 'compact'
}

const formatDistance = (km?: number) => {
  if (typeof km !== 'number' || !isFinite(km)) return null
  const mi = km * 0.621371
  if (mi < 0.1) return '0.1mi'
  if (mi < 10) return `${mi.toFixed(1)}mi`
  return `${Math.round(mi)}mi`
}

const prettyType = (t?: string) =>
  t ? t.replace(/_/g, ' ').toUpperCase() : null

export default function DiscoveryCard({
  item,
  onOpen,
  onSave,
  onDismiss,
  loadImage = false,
  variant = 'standard',
}: DiscoveryCardProps) {
  const theme = pickTheme(item.primaryType, item.types)
  const distance = formatDistance(item.distanceKm)
  const typeLabel = prettyType(item.primaryType || item.types?.[0]) || theme.label.toUpperCase()

  // Editorial vertical card. Compact = grid use; standard = single-column use.
  const aspect = variant === 'compact' ? 'aspect-[5/6]' : 'aspect-[4/5]'

  // Density chip — only when the place has earned it
  const friendChip = (item.friendCount && item.friendCount > 0)
    ? `${item.friendCount} ${item.friendCount === 1 ? 'friend' : 'friends'}`
    : null
  const postChip = (item.postCount && item.postCount > 0)
    ? `${item.postCount} ${item.postCount === 1 ? 'post' : 'posts'}`
    : null
  const saveChip = (!friendChip && item.savedCount && item.savedCount >= 3)
    ? `${item.savedCount} saves`
    : null
  const densityChip = friendChip || postChip || saveChip

  return (
    <article
      onClick={onOpen}
      className="group relative w-full cursor-pointer press"
    >
      <div
        className={`relative ${aspect} w-full overflow-hidden rounded-[14px] bg-card transition-all duration-300 group-hover:shadow-[0_2px_0_rgba(92,58,27,0.08),_0_24px_48px_-14px_rgba(92,58,27,0.32)]`}
        style={{ boxShadow: '0 1px 0 rgba(92,58,27,0.08), 0 16px 32px -12px rgba(92,58,27,0.20)' }}
      >
        {item.kind === 'place' ? (
          <HubImage
            photos={item.photos}
            userImage={item.imageUrl}
            primaryType={item.primaryType}
            types={item.types}
            alt={item.title}
            load={loadImage}
            aspect={aspect}
            className="w-full h-full"
          />
        ) : item.imageUrl ? (
          <img
            src={item.imageUrl}
            alt={item.title}
            loading="lazy"
            className="absolute inset-0 w-full h-full object-cover"
          />
        ) : (
          <PlacePoster
            primaryType={item.primaryType}
            types={item.types}
            name={item.title}
            className="absolute inset-0 w-full h-full"
          />
        )}

        {/* Bottom inset gradient — keeps caption legible on photographs */}
        <div className="absolute inset-x-0 bottom-0 h-2/5 pointer-events-none"
             style={{ background: 'linear-gradient(to top, rgba(0,0,0,0.55), transparent)' }} />

        {/* Density chip — amber glass jewel, only when there's social signal */}
        {densityChip && (
          <span className="glass-leaf absolute top-3 left-3 inline-flex items-center gap-1.5 px-2.5 h-6 rounded-full font-mono text-[10px] tracking-[0.10em] uppercase">
            <span className="accent-bead accent-bead-sm" aria-hidden />
            {densityChip}
          </span>
        )}

        {/* Action cluster — "not interested" (tunes the feed) + save */}
        {(onSave || onDismiss) && (
          <div className="absolute top-3 right-3 flex items-center gap-1.5">
            {onDismiss && (
              <button
                onClick={e => { e.stopPropagation(); onDismiss() }}
                className="press h-9 w-9 rounded-full bg-white/85 backdrop-blur-sm flex items-center justify-center hover:bg-white transition-colors"
                aria-label="Not interested — show less like this"
                title="Not interested"
              >
                <HandThumbDownIcon className="w-[17px] h-[17px] text-ink-soft" />
              </button>
            )}
            {onSave && (
              <button
                onClick={e => { e.stopPropagation(); onSave() }}
                className="press h-9 w-9 rounded-full bg-white/95 backdrop-blur-sm flex items-center justify-center hover:bg-white transition-colors"
                aria-label={item.saved ? 'Saved' : 'Save'}
              >
                {item.saved ? (
                  <BookmarkIconSolid className="w-[18px] h-[18px] text-ink" />
                ) : (
                  <BookmarkIcon className="w-[18px] h-[18px] text-ink" />
                )}
              </button>
            )}
          </div>
        )}

        {/* Caption block — overlaid on bottom of photo */}
        <div className="absolute inset-x-3 bottom-3 text-white">
          {item.reason ? (
            <p className="font-display-italic text-[12px] leading-tight mb-1 line-clamp-1" style={{ color: '#F6E7C8' }}>
              {item.reason}
            </p>
          ) : (
            <p className="font-mono text-[10px] tracking-[0.16em] opacity-80 mb-1">
              {[distance, typeLabel].filter(Boolean).join('  ·  ')}
            </p>
          )}
          <h3 className="font-display text-[20px] leading-[1.05] line-clamp-2">
            {item.title}
          </h3>
          {item.reason && (distance || typeLabel) && (
            <p className="font-mono text-[9px] tracking-[0.16em] opacity-70 mt-1">
              {[distance, typeLabel].filter(Boolean).join('  ·  ')}
            </p>
          )}
        </div>
      </div>
    </article>
  )
}
