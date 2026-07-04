/**
 * THE OVERLAP (/with/:uid) — "discovery of friends' tastes" at its sharpest
 * edge: one friend, one screen. Two lists computed entirely from the flat
 * `saves` collection, zero new storage:
 *   YOU BOTH — rooms you and they have each kept (both-Loved first). The proof
 *     your tastes agree.
 *   WHERE {name} CAN TAKE YOU — the rooms THEY loved that you've never kept.
 *     Their taste, handed to you as your next few nights out.
 * Not a leaderboard, not a feed: strictly pairwise, never ranked across people.
 */
import { useMemo } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { useSession } from '../state/session'
import { fetchMySaves, type FriendSave, type Tag } from '../data/social'
import { fetchUsers } from '../data/user'
import { typeLabel } from '../data/vibes'
import { usePlacePhoto } from '../lib/usePlacePhoto'
import { PinVisual } from '../components/PinVisual'
import { Masonry } from '../components/Masonry'
import { Avatar } from '../components/Avatar'
import { signIn } from '../lib/authWatch'

const TAG_RANK: Record<Tag, number> = { loved: 0, tried: 1, want: 2 }

export default function Overlap() {
  const { uid: friendUid = '' } = useParams<{ uid: string }>()
  const navigate = useNavigate()
  const session = useSession()
  const myUid = session.status === 'signed-in' ? session.user.uid : null

  const { data: friend } = useQuery({
    queryKey: ['user', friendUid],
    enabled: Boolean(friendUid),
    staleTime: 5 * 60_000,
    queryFn: async () => (await fetchUsers([friendUid]))[0],
  })
  const { data: mine } = useQuery({
    queryKey: ['mySaves', myUid],
    enabled: Boolean(myUid),
    staleTime: 30_000,
    queryFn: () => fetchMySaves(myUid!),
  })
  const { data: theirs } = useQuery({
    queryKey: ['userSaves', friendUid],
    enabled: Boolean(friendUid),
    staleTime: 30_000,
    queryFn: () => fetchMySaves(friendUid),
  })

  const myByPlace = useMemo(() => new Map((mine ?? []).map(s => [s.placeId, s])), [mine])

  // YOU BOTH — places you've each kept; strongest shared tag first.
  const both = useMemo(() => {
    return (theirs ?? [])
      .filter(t => myByPlace.has(t.placeId))
      .map(t => ({ their: t, mine: myByPlace.get(t.placeId)! }))
      .sort((a, b) =>
        (TAG_RANK[a.their.tag] + TAG_RANK[a.mine.tag]) - (TAG_RANK[b.their.tag] + TAG_RANK[b.mine.tag]))
  }, [theirs, myByPlace])

  // WHERE THEY CAN TAKE YOU — their Loved rooms you haven't kept at all.
  const takeYou = useMemo(
    () => (theirs ?? []).filter(t => t.tag === 'loved' && !myByPlace.has(t.placeId)),
    [theirs, myByPlace]
  )

  const name = friend?.displayName ?? 'them'
  const firstName = name.split(/\s+/)[0]

  if (!myUid) {
    return (
      <div className="page">
        <button className="eyebrow back-link press" onClick={() => navigate(-1)}>← BACK</button>
        <section className="empty-state">
          <h1 className="t-display">See where your tastes meet.</h1>
          <p className="t-body">Sign in to see the rooms you and your people both love.</p>
          <button className="pill pill-primary press" onClick={() => void signIn()}>Continue with Google</button>
        </section>
      </div>
    )
  }

  if (friendUid === myUid) {
    return (
      <div className="page">
        <button className="eyebrow back-link press" onClick={() => navigate(-1)}>← BACK</button>
        <section className="empty-state">
          <h1 className="t-display">That's you.</h1>
          <p className="t-body">Your own rooms live on your Wall.</p>
          <Link to="/saved" className="pill pill-primary press">Open your Wall</Link>
        </section>
      </div>
    )
  }

  const loading = mine === undefined || theirs === undefined
  const nothing = !loading && both.length === 0 && takeYou.length === 0

  return (
    <div className="page">
      <button className="eyebrow back-link press" onClick={() => navigate(-1)}>← BACK</button>

      <header className="overlap-head">
        <Avatar name={name} hex={friend?.avatarHex ?? '#8E5A6B'} size={56} />
        <div>
          <p className="eyebrow">YOU &amp; {name.toUpperCase()}</p>
          <h1 className="t-display">Where your tastes meet.</h1>
        </div>
      </header>

      {loading && (
        <div className="masonry" aria-hidden>
          {Array.from({ length: 4 }, (_, i) => <div key={i} className="pin-card skeleton" />)}
        </div>
      )}

      {both.length > 0 && (
        <section className="overlap-section">
          <p className="eyebrow section-label">YOU BOTH</p>
          <Masonry>
            {both.map(({ their, mine: myS }) => (
              <OverlapCard
                key={their.placeId}
                save={their}
                footer={
                  <span className="overlap-tags eyebrow">
                    you <b className={myS.tag === 'loved' ? 'tag-hot' : ''}>{myS.tag}</b>
                    {' · '}{firstName} <b className={their.tag === 'loved' ? 'tag-hot' : ''}>{their.tag}</b>
                  </span>
                }
              />
            ))}
          </Masonry>
        </section>
      )}

      {takeYou.length > 0 && (
        <section className="overlap-section">
          <p className="eyebrow section-label">WHERE {firstName.toUpperCase()} CAN TAKE YOU</p>
          <Masonry>
            {takeYou.map(t => (
              <OverlapCard
                key={t.placeId}
                save={t}
                footer={<span className="overlap-tags eyebrow">{firstName} <b className="tag-hot">loved</b></span>}
              />
            ))}
          </Masonry>
        </section>
      )}

      {nothing && (
        <section className="empty-state">
          <h2 className="t-display">No overlap yet.</h2>
          <p className="t-body">
            When you and {firstName} both keep a room — or {firstName} loves somewhere new — it lands here.
          </p>
        </section>
      )}
    </div>
  )
}

function OverlapCard({ save, footer }: { save: FriendSave; footer: React.ReactNode }) {
  const navigate = useNavigate()
  const photo = usePlacePhoto(save.placeId)
  const place = save.place
  if (!place) return null
  const open = () => navigate(`/p/${save.placeId}`)
  return (
    <article
      className={`pin-card press${save.tag === 'loved' ? ' is-been' : ''}`}
      role="link"
      tabIndex={0}
      aria-label={place.name}
      onClick={open}
      onKeyDown={e => { if (e.key === 'Enter') open() }}
    >
      <PinVisual hex={place.hex} photoSrc={photo.src} attribution={photo.credit} alt={place.name} />
      <div className="pin-scrim" aria-hidden />
      <div className="pin-caption">
        {save.note && <p className="pin-pov">“{save.note}”</p>}
        <h3 className="pin-title">{place.name}</h3>
        <p className="pin-chip eyebrow">
          {[typeLabel(place.primaryType), place.neighborhood].filter(Boolean).join(' · ')}
        </p>
        {footer}
      </div>
    </article>
  )
}
