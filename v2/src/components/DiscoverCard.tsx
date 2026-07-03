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
import { useSaveFlow } from '../data/queries'
import { useSession } from '../state/session'
import { signIn } from '../lib/authWatch'
import { haptics } from '../lib/haptics'
import { PinVisual } from './PinVisual'

export function DiscoverCard({ place }: { place: PlaceDoc }) {
  const navigate = useNavigate()
  const session = useSession()
  const { save } = useSaveFlow()
  const photo = usePlacePhoto(place.id)

  // The curator POV is the hero — the whole product is the opinion. Below the
  // name, one quiet line: walk time if we have it, else the type.
  const chip = walkChip(place.lat, place.lng, place.coordsFetchedAt) ?? typeLabel(place.primaryType)

  const onSave = (e: React.MouseEvent) => {
    e.stopPropagation()
    haptics.tap()
    if (session.status !== 'signed-in') {
      void signIn()
      return
    }
    save.mutate({
      place: {
        id: place.id,
        name: place.name,
        primaryType: place.primaryType,
        lat: place.lat,
        lng: place.lng,
        neighborhood: place.neighborhood,
      },
    })
  }

  return (
    <article
      className="pin-card press"
      role="link"
      tabIndex={0}
      aria-label={place.name}
      onClick={() => navigate(`/p/${place.id}`)}
      onKeyDown={e => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          navigate(`/p/${place.id}`)
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
      <button className="pin-bookmark is-unsaved press" onClick={onSave} aria-label={`Save ${place.name}`}>
        <BookmarkOutline />
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
