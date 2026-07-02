/**
 * The pin card — v1 DiscoveryCard's Pinterest-grade anatomy, rebuilt:
 * 5:6 image-dominant, bottom scrim, display-face title, one italic six-word
 * reason line, mono chip, floating bookmark. Been pins are celebrated
 * (`is-been`); pins untouched 90 days recede (`is-stale`).
 */
import { useNavigate } from 'react-router-dom'
import type { Pin } from '../data/types'
import { typeLabel } from '../data/vibes'
import { walkChip } from '../lib/geo'
import { PinVisual } from './PinVisual'

const STALE_MS = 90 * 24 * 60 * 60 * 1000

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]

/** The italic six-word line. If it can't be said honestly, say nothing. */
export function reasonFor(pin: Pin): string | null {
  if (pin.status === 'been' && pin.sixWordNote) return pin.sixWordNote
  if (pin.note) return pin.note.length <= 48 ? pin.note : null
  const saved = new Date(pin.savedAt)
  const monthsAgo = (Date.now() - pin.savedAt) / (30 * 24 * 60 * 60 * 1000)
  if (monthsAgo >= 1) return `you saved this in ${MONTHS[saved.getMonth()]}`
  return null
}

interface PinCardProps {
  pin: Pin
  /** Overrides the computed reason line (feed ranking will pass its own). */
  reason?: string
}

export function PinCard({ pin, reason }: PinCardProps) {
  const navigate = useNavigate()

  const line = reason ?? reasonFor(pin)
  const proximityLine = line ? /min away|around the corner/i.test(line) : false
  const chip = [
    proximityLine ? null : walkChip(pin.snapshot.lat, pin.snapshot.lng, pin.snapshot.coordsAt),
    typeLabel(pin.snapshot.primaryType),
  ]
    .filter(Boolean)
    .join(' · ')
  const isStale = pin.status === 'want' && Date.now() - pin.lastTouchedAt > STALE_MS
  const stateClass = `${pin.status === 'been' ? ' is-been' : ''}${isStale ? ' is-stale' : ''}`

  const open = () => navigate(`/p/${pin.id}`)

  return (
    <article
      className={`pin-card press${stateClass}`}
      role="link"
      tabIndex={0}
      aria-label={pin.snapshot.name}
      onClick={open}
      onKeyDown={e => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          open()
        }
      }}
    >
      <PinVisual
        hex={pin.snapshot.hex}
        photoSrc={pin.userPhotoPath}
        alt={pin.snapshot.name}
      />
      <div className="pin-scrim" aria-hidden />
      <span className="pin-bookmark is-saved" aria-hidden>
        <BookmarkSolid />
      </span>
      {pin.status === 'been' && <span className="been-mark eyebrow">BEEN</span>}
      <div className="pin-caption">
        {line && <p className="pin-reason">{line}</p>}
        <h3 className="pin-title">{pin.snapshot.name}</h3>
        {chip && <p className="pin-chip eyebrow">{chip}</p>}
      </div>
    </article>
  )
}

function BookmarkSolid() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M7 3.5h10a1 1 0 0 1 1 1V21l-6-4-6 4V4.5a1 1 0 0 1 1-1Z" />
    </svg>
  )
}
