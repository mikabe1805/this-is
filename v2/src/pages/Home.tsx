/**
 * HOME — "discovery of friends' tastes" (v2/FRIENDS.md). Two layers that never
 * pretend to be the same thing:
 *   Layer 1 — THE FRIEND FEED: your circle's nights out, each card a room with
 *     who tagged it and their note. The premium layer.
 *   Layer 2 — NEARBY & UNEXPLORED: the seeded scaffold so the app is never
 *     empty on day one; tap a bookmark to Want it onto your Wall.
 */
import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import { useSession } from '../state/session'
import { useCurated, useFriendFeed, useMySaves, useUserDoc } from '../data/queries'
import { tasteFromSaves, type Taste } from '../data/taste'
import { walkMinutesBetween, cachedCoords, type Coords } from '../lib/geo'
import { Masonry } from '../components/Masonry'
import { DiscoverCard } from '../components/DiscoverCard'
import { FriendFeedCard } from '../components/FriendFeedCard'
import { EmptyScene } from '../components/EmptyScene'
import { signIn } from '../lib/authWatch'
import { haptics } from '../lib/haptics'
import type { PlaceDoc } from '../data/types'

/** Taste + proximity over the scaffold, minus what you already keep. */
function rankScaffold(catalog: PlaceDoc[], mine: Set<string>, taste: Taste, coords: Coords | null): PlaceDoc[] {
  return catalog
    .filter(c => !mine.has(c.id))
    .map(c => {
      let tasteScore = 0
      for (const tag of c.vibeTags ?? []) tasteScore = Math.max(tasteScore, taste[tag] ?? 0)
      const walk = coords ? walkMinutesBetween(coords, c.lat, c.lng, c.coordsFetchedAt) : null
      const prox = walk === null ? 0 : 1 - Math.min(walk, 90) / 90
      return { place: c, score: tasteScore * 3 + prox * 2 }
    })
    .sort((a, b) => b.score - a.score)
    .map(x => x.place)
}

export default function Home() {
  const session = useSession()
  const { data: feed, isLoading: feedLoading } = useFriendFeed()
  const { data: curated } = useCurated()
  const { data: mySaves } = useMySaves()
  const { data: userDoc } = useUserDoc()
  const coords = cachedCoords()

  const taste = useMemo(
    () => tasteFromSaves(mySaves ?? [], userDoc?.tasteSeed ?? []),
    [mySaves, userDoc?.tasteSeed]
  )
  const mine = useMemo(() => new Set((mySaves ?? []).map(s => s.placeId)), [mySaves])

  // Layer 1: friend saves that carry a renderable place snapshot.
  const friendItems = useMemo(() => (feed ?? []).filter(s => s.place), [feed])
  const feedPlaceIds = useMemo(() => new Set(friendItems.map(s => s.placeId)), [friendItems])

  // Layer 2: the scaffold, minus what's already on your Wall or in the feed.
  const scaffold = useMemo(
    () => rankScaffold((curated ?? []).filter(c => !feedPlaceIds.has(c.id)), mine, taste, coords),
    [curated, feedPlaceIds, mine, taste, coords]
  )

  return (
    <div className="page">
      <header className="masthead">
        <h1 className="wordmark">this.is</h1>
        <p className="masthead-sub">Where your people actually go.</p>
      </header>

      {feedLoading && <MasonrySkeleton />}

      {friendItems.length > 0 && (
        <section className="friend-feed">
          <p className="eyebrow section-label">FROM YOUR PEOPLE</p>
          {friendItems.map(save => (
            <FriendFeedCard key={save.id} save={save} />
          ))}
        </section>
      )}

      {friendItems.length === 0 && !feedLoading && (
        <Link to="/settings" className="taste-nudge press">
          <span className="eyebrow">YOUR CIRCLE IS QUIET</span>
          <span className="taste-nudge-line">Invite a few friends to see where they go →</span>
        </Link>
      )}

      {scaffold.length > 0 && (
        <>
          <p className="eyebrow section-label scaffold-label">NEARBY &amp; UNEXPLORED</p>
          <Masonry>
            {scaffold.map(place => (
              <DiscoverCard key={place.id} place={place} />
            ))}
          </Masonry>
          <p className="t-small attribution-line">
            place data <span className="google-mark">Google Maps</span>
          </p>
        </>
      )}

      {!feedLoading && friendItems.length === 0 && scaffold.length === 0 && (
        <section className="empty-state">
          <EmptyScene />
          <h2 className="t-display">Quiet in here.</h2>
          <p className="t-body">Nearby places will fill in as we reach your city.</p>
        </section>
      )}

      {session.status === 'signed-out' && (
        <div className="signin-foot glass-chrome">
          <p className="t-small">Save the rooms you want — and see your friends' too.</p>
          <button className="pill pill-primary press" onClick={() => { haptics.tap(); void signIn() }}>
            Continue with Google
          </button>
        </div>
      )}
    </div>
  )
}

function MasonrySkeleton() {
  return (
    <div className="masonry" aria-hidden>
      {Array.from({ length: 6 }, (_, i) => (
        <div key={i} className="pin-card skeleton" />
      ))}
    </div>
  )
}
