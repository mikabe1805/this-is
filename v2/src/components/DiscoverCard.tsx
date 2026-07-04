/**
 * A discovery card — a place from the seeded city pool that you haven't kept
 * yet. Real Google photo when the session photo-budget allows (fetched live,
 * ref via the free tier, never cached), plate otherwise. The bookmark is a
 * true one-tap save; tapping the card opens the closeup (which handles
 * unsaved places).
 */
import { useNavigate } from 'react-router-dom'
import type { PlaceDoc } from '../data/types'
import { typeLabel } from '../data/vibes'
import { walkChip } from '../lib/geo'
import { usePlacePhoto } from '../lib/usePlacePhoto'
import { useMySaves, useSaveFlow } from '../data/queries'
import { useSession } from '../state/session'
import { signIn } from '../lib/authWatch'
import { haptics } from '../lib/haptics'
import { PinVisual } from './PinVisual'

export function DiscoverCard({ place }: { place: PlaceDoc }) {
  const navigate = useNavigate()
  const session = useSession()
  const { setTag } = useSaveFlow()
  const { data: mySaves } = useMySaves()
  const photo = usePlacePhoto(place.id)

  // Is this room already on your Wall? If so the bookmark is a status light,
  // not a save button — tapping it opens the closeup to change or remove the
  // tag rather than force-writing, so it can't demote a Loved room to Want.
  // `undefined` means we don't know yet (saves still loading) — treated the
  // same as "already saved" below, so we never blind-write over a tag we can't
  // see.
  const mine = mySaves?.find(s => s.placeId === place.id)

  // The curator POV is the hero — the whole product is the opinion. Below the
  // name, one quiet line: walk time if we have it, else the type.
  const chip = walkChip(place.lat, place.lng, place.coordsFetchedAt) ?? typeLabel(place.primaryType)

  const open = () => navigate(`/p/${place.id}`)

  const onBookmark = (e: React.MouseEvent) => {
    e.stopPropagation()
    if (session.status !== 'signed-in') {
      haptics.tap()
      void signIn()
      return
    }
    if (mine || mySaves === undefined) {
      // Already saved, or saves not loaded yet — manage in the closeup instead
      // of writing, so a quick tap never demotes a tag we can't see.
      open()
      return
    }
    setTag.mutate({
      tag: 'want',
      place: {
        id: place.id,
        name: place.name,
        primaryType: place.primaryType,
        neighborhood: place.neighborhood,
        hex: place.photoHex,
        lat: place.lat,
        lng: place.lng,
      },
    })
  }

  return (
    <article
      className="pin-card press"
      role="link"
      tabIndex={0}
      aria-label={mine ? `${place.name} — ${mine.tag}` : place.name}
      onClick={open}
      onKeyDown={e => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          open()
        }
      }}
    >
      <PinVisual
        hex={place.photoHex}
        photoSrc={photo?.src}
        attribution={photo?.credit}
        alt={place.name}
      />
      <div className="pin-scrim" aria-hidden />
      <button
        className={`pin-bookmark press ${mine ? `is-saved fg-${mine.tag}` : 'is-unsaved'}`}
        onClick={onBookmark}
        aria-label={mine ? `${place.name}: ${mine.tag} — change or remove` : `Save ${place.name}`}
      >
        {mine ? <BookmarkFilled /> : <BookmarkOutline />}
      </button>
      <div className="pin-caption">
        <h3 className="pin-title">{place.name}</h3>
        {place.curatorPOV && <p className="pin-pov">{place.curatorPOV}</p>}
        {chip && <p className="pin-chip eyebrow">{chip}</p>}
      </div>
    </article>
  )
}

function BookmarkOutline() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
      <path d="M7 3.5h10a1 1 0 0 1 1 1V21l-6-4-6 4V4.5a1 1 0 0 1 1-1Z" strokeLinejoin="round" />
    </svg>
  )
}

function BookmarkFilled() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" strokeWidth="1.4" aria-hidden>
      <path d="M7 3.5h10a1 1 0 0 1 1 1V21l-6-4-6 4V4.5a1 1 0 0 1 1-1Z" strokeLinejoin="round" />
    </svg>
  )
}
