/**
 * YOUR WALL (v2/FRIENDS.md) — a flat, beautifully filtered grid of everywhere
 * you Want / Tried / Loved. No boards; the tag filter is the whole structure.
 */
import { useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useSession } from '../state/session'
import { useMySaves } from '../data/queries'
import { Masonry } from '../components/Masonry'
import { PinVisual } from '../components/PinVisual'
import { EmptyScene } from '../components/EmptyScene'
import { usePlacePhoto } from '../lib/usePlacePhoto'
import { typeLabel } from '../data/vibes'
import { signIn } from '../lib/authWatch'
import type { FriendSave, Tag } from '../data/social'

const FILTERS: Tag[] = ['want', 'tried', 'loved']

export default function Wall() {
  const session = useSession()
  const { data: saves } = useMySaves()
  const [filter, setFilter] = useState<Tag>('want')

  if (session.status === 'signed-out') {
    return (
      <div className="page">
        <header className="page-header"><p className="eyebrow">YOUR WALL</p></header>
        <section className="empty-state">
          <EmptyScene />
          <h2 className="t-display">The rooms you're keeping.</h2>
          <p className="t-body">Sign in and everywhere you Want, Tried, or Loved lives here.</p>
          <button className="pill pill-primary press" onClick={() => void signIn()}>
            Continue with Google
          </button>
        </section>
      </div>
    )
  }

  const all = saves ?? []
  const counts = useMemo(() => ({
    want: all.filter(s => s.tag === 'want').length,
    tried: all.filter(s => s.tag === 'tried').length,
    loved: all.filter(s => s.tag === 'loved').length,
  }), [all])
  const shown = all.filter(s => s.tag === filter)

  return (
    <div className="page">
      <header className="page-header">
        <div>
          <p className="eyebrow">YOUR WALL</p>
          {all.length > 0 && (
            <p className="eyebrow stat-line">{all.length} ROOM{all.length === 1 ? '' : 'S'}</p>
          )}
        </div>
      </header>

      {all.length === 0 ? (
        <section className="empty-state">
          <EmptyScene />
          <h2 className="t-display">Nothing kept yet.</h2>
          <p className="t-body">Tap a room's Want, Tried, or Loved and it lands here.</p>
          <Link to="/home" className="pill pill-primary press">Find somewhere</Link>
        </section>
      ) : (
        <>
          <div className="seg" role="tablist" aria-label="Wall filter">
            {FILTERS.map(f => (
              <button
                key={f}
                role="tab"
                aria-selected={filter === f}
                className={`seg-tab press${filter === f ? ' is-active' : ''}`}
                onClick={() => setFilter(f)}
              >
                {f} {counts[f] > 0 ? counts[f] : ''}
              </button>
            ))}
          </div>
          {shown.length === 0 ? (
            <p className="t-small thin-feed">Nothing tagged {filter} yet.</p>
          ) : (
            <Masonry>
              {shown.map(s => <WallCard key={s.id} save={s} />)}
            </Masonry>
          )}
        </>
      )}
    </div>
  )
}

function WallCard({ save }: { save: FriendSave }) {
  const navigate = useNavigate()
  const photo = usePlacePhoto(save.placeId)
  const place = save.place
  if (!place) return null
  return (
    <article
      className={`pin-card press${save.tag === 'loved' ? ' is-been' : ''}`}
      role="link"
      tabIndex={0}
      aria-label={place.name}
      onClick={() => navigate(`/p/${save.placeId}`)}
      onKeyDown={e => { if (e.key === 'Enter') navigate(`/p/${save.placeId}`) }}
    >
      <PinVisual hex={place.hex} photoSrc={photo.src} attribution={photo.credit} alt={place.name} />
      <div className="pin-scrim" aria-hidden />
      <span className={`been-mark eyebrow fg-${save.tag}`}>{save.tag}</span>
      <div className="pin-caption">
        {save.note && <p className="pin-pov">“{save.note}”</p>}
        <h3 className="pin-title">{place.name}</h3>
        <p className="pin-chip eyebrow">
          {[typeLabel(place.primaryType), place.neighborhood].filter(Boolean).join(' · ')}
        </p>
      </div>
    </article>
  )
}
