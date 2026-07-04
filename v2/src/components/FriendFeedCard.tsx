/**
 * A friend-feed item — a moment in your circle's going-out life. The photo of
 * the room, who tagged it and how (LOVED in madder), and their note below like
 * a text you'd forward. Renders entirely from the save's denormalized place
 * snapshot — no joins.
 */
import { Link, useNavigate } from 'react-router-dom'
import type { FriendSave } from '../data/social'
import { typeLabel } from '../data/vibes'
import { usePlacePhoto } from '../lib/usePlacePhoto'
import { PinVisual } from './PinVisual'
import { Avatar } from './Avatar'

export function FriendFeedCard({ save }: { save: FriendSave }) {
  const navigate = useNavigate()
  const photo = usePlacePhoto(save.placeId)
  const place = save.place
  if (!place) return null
  const open = () => navigate(`/p/${save.placeId}`)

  return (
    <article
      className="feedcard press"
      role="link"
      tabIndex={0}
      aria-label={`${save.user?.displayName ?? 'A friend'} ${save.tag} ${place.name}`}
      onClick={open}
      onKeyDown={e => { if (e.key === 'Enter') open() }}
    >
      <div className="feedcard-visual">
        <PinVisual hex={place.hex} photoSrc={photo.src} attribution={photo.credit} alt={place.name} />
        <div className="pin-scrim" aria-hidden />
        {/* Tap the person → the two of you (/with/:uid); stop the tap from
            also opening the spot page underneath. */}
        <Link
          className="feedcard-attr press"
          to={`/with/${save.uid}`}
          onClick={e => e.stopPropagation()}
          onKeyDown={e => e.stopPropagation()}
        >
          <Avatar name={save.user?.displayName ?? '?'} hex={save.user?.avatarHex ?? '#5A6B8E'} size={26} />
          <span className="feedcard-who">
            <strong>{save.user?.displayName ?? 'Someone'}</strong>{' '}
            <span className={`fg-tag fg-${save.tag}`}>{save.tag}</span>
          </span>
        </Link>
        <div className="feedcard-body">
          <h3 className="feedcard-name">{place.name}</h3>
          <p className="pin-chip eyebrow">
            {[typeLabel(place.primaryType), place.neighborhood].filter(Boolean).join(' · ')}
          </p>
        </div>
      </div>
      {save.note && <p className="feedcard-note">“{save.note}”</p>}
    </article>
  )
}
