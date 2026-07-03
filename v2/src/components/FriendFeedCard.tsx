/**
 * A friend-feed item — a moment in your circle's going-out life. The photo of
 * the room, who tagged it and how (LOVED in madder), and their note below like
 * a text you'd forward. Full-width, so the friend layer reads distinctly from
 * the 2-col "nearby & unexplored" scaffold underneath it.
 */
import { useNavigate } from 'react-router-dom'
import type { FriendSave } from '../data/social'
import type { PlaceDoc } from '../data/types'
import { typeLabel } from '../data/vibes'
import { usePlacePhoto } from '../lib/usePlacePhoto'
import { PinVisual } from './PinVisual'
import { Avatar } from './Avatar'

export function FriendFeedCard({ save, place }: { save: FriendSave; place: PlaceDoc }) {
  const navigate = useNavigate()
  const photo = usePlacePhoto(place.id)
  const open = () => navigate(`/p/${place.id}`)

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
        <PinVisual hex={place.photoHex} photoSrc={photo.src} attribution={photo.credit} alt={place.name} />
        <div className="pin-scrim" aria-hidden />
        <div className="feedcard-attr">
          <Avatar name={save.user?.displayName ?? '?'} hex={save.user?.avatarHex ?? '#5A6B8E'} size={26} />
          <span className="feedcard-who">
            <strong>{save.user?.displayName ?? 'Someone'}</strong>{' '}
            <span className={`fg-tag fg-${save.tag}`}>{save.tag}</span>
          </span>
        </div>
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
