/**
 * HOME — "discovery of friends' tastes" (v2/FRIENDS.md). Layers that never
 * pretend to be the same thing:
 *   YOUR PEOPLE HERE — friends' Loved rooms that are near you *right now*. The
 *     travel magic: land somewhere a friend knows and their taste is waiting.
 *   FROM YOUR PEOPLE — the rest of your circle's nights out (Layer 1).
 *   NEARBY & UNEXPLORED — the geo-cell scaffold + genuinely-near curated rooms,
 *     honestly labeled: only rooms with a real walk time appear here.
 *   ON THE LOW-LIT LIST — the curated city guide (rooms with no proximity
 *     claim), so a far-away curated scene is never mislabeled "nearby".
 */
import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import { useSession } from '../state/session'
import { useCandidates, useCurated, useFriendFeed, useMySaves, useUserDoc } from '../data/queries'
import { tasteFromSaves, type Taste } from '../data/taste'
import { walkChip, walkMinutesBetween, cachedCoords, type Coords } from '../lib/geo'
import { Masonry } from '../components/Masonry'
import { DiscoverCard } from '../components/DiscoverCard'
import { FriendFeedCard } from '../components/FriendFeedCard'
import { EmptyScene } from '../components/EmptyScene'
import { signIn } from '../lib/authWatch'
import { haptics } from '../lib/haptics'
import type { PlaceDoc } from '../data/types'
import type { FriendSave } from '../data/social'

/** How close a friend's Loved room must be to count as "here" now. */
const HERE_MINUTES = 30

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
  const coords = cachedCoords()
  const { data: feed, isLoading: feedLoading } = useFriendFeed()
  const { data: curated, isLoading: curatedLoading } = useCurated()
  const { data: candidates, isLoading: candLoading } = useCandidates(coords)
  const { data: mySaves } = useMySaves()
  const { data: userDoc, isLoading: userDocLoading } = useUserDoc()

  const taste = useMemo(
    () => tasteFromSaves(mySaves ?? [], userDoc?.tasteSeed ?? []),
    [mySaves, userDoc?.tasteSeed]
  )
  const mine = useMemo(() => new Set((mySaves ?? []).map(s => s.placeId)), [mySaves])

  // THE WANT THAT GOT LOVED — a friend just Loved a room on your Want wall: the
  // moment a someday-Want becomes tonight's plan. One card, the most recent.
  const wantSpark = useMemo(() => {
    const myWants = new Set((mySaves ?? []).filter(s => s.tag === 'want').map(s => s.placeId))
    if (!myWants.size) return null
    let best: FriendSave | null = null
    for (const s of feed ?? []) {
      if (s.tag !== 'loved' || !s.place || !myWants.has(s.placeId)) continue
      if (!best || s.ts > best.ts) best = s
    }
    return best
  }, [mySaves, feed])
  // Dedupe the whole venue (by placeId, not just this save) so the spark room
  // can't also appear under YOUR PEOPLE HERE / FROM YOUR PEOPLE via another friend.
  const sparkPlaceId = wantSpark?.placeId

  // YOUR PEOPLE HERE — a followed friend's Loved rooms within a short walk now.
  // A friend's denormalized snapshot carries no coords timestamp, so the 30-day
  // staleness gate NEARBY uses doesn't apply here — venue coordinates are stable
  // (a bar doesn't move), so a distance from them is honest regardless of age.
  const peopleHere = useMemo(() => {
    if (!coords) return []
    const out: { save: FriendSave; walk: number }[] = []
    for (const s of feed ?? []) {
      const p = s.place
      if (s.placeId === sparkPlaceId) continue // shown as the spark above
      if (s.tag !== 'loved' || !p || typeof p.lat !== 'number' || typeof p.lng !== 'number') continue
      const walk = walkMinutesBetween(coords, p.lat, p.lng)
      if (walk === null || walk > HERE_MINUTES) continue
      out.push({ save: s, walk })
    }
    return out.sort((a, b) => a.walk - b.walk).slice(0, 4)
  }, [feed, coords, sparkPlaceId])
  const hereIds = useMemo(() => new Set(peopleHere.map(x => x.save.id)), [peopleHere])

  // Layer 1: the rest of the friend feed (with a renderable snapshot), minus
  // the ones already surfaced under YOUR PEOPLE HERE.
  const friendItems = useMemo(
    () => (feed ?? []).filter(s => s.place && !hereIds.has(s.id) && s.placeId !== sparkPlaceId),
    [feed, hereIds, sparkPlaceId]
  )
  const feedPlaceIds = useMemo(
    () => new Set([...peopleHere.map(x => x.save.placeId), ...friendItems.map(s => s.placeId)]),
    [peopleHere, friendItems]
  )

  // Discovery pool: the geo-cell scaffold + curated, deduped (curated wins),
  // minus your Wall and anything already in the feed.
  const scaffold = useMemo(() => {
    const pool = new Map<string, PlaceDoc>()
    for (const c of candidates ?? []) pool.set(c.id, c)
    for (const c of curated ?? []) pool.set(c.id, c)
    return rankScaffold(
      [...pool.values()].filter(c => !feedPlaceIds.has(c.id)),
      mine, taste, coords
    )
  }, [candidates, curated, feedPlaceIds, mine, taste, coords])

  // Honest split: a room only sits under "NEARBY" if it has a real walk time.
  const nearby = useMemo(
    () => scaffold.filter(p => walkChip(p.lat, p.lng, p.coordsFetchedAt) !== null),
    [scaffold]
  )
  const list = useMemo(() => {
    const nearIds = new Set(nearby.map(p => p.id))
    return scaffold.filter(p => !nearIds.has(p.id))
  }, [scaffold, nearby])

  const anyContent =
    Boolean(wantSpark) || peopleHere.length > 0 || friendItems.length > 0 || nearby.length > 0 || list.length > 0
  // Include userDoc: the feed depends on `following`, so an empty result before
  // the follow list loads must not read as "quiet" (nudge) or "nothing here".
  const stillLoading = feedLoading || curatedLoading || candLoading || userDocLoading
  const signedIn = session.status === 'signed-in'

  return (
    <div className="page">
      <header className="masthead">
        <h1 className="wordmark">this.is</h1>
        <p className="masthead-sub">Where your people actually go.</p>
      </header>

      {stillLoading && !anyContent && <MasonrySkeleton />}

      {wantSpark?.place && (
        <Link to={`/p/${wantSpark.placeId}`} className="want-spark press">
          <span className="eyebrow">ON YOUR LIST — NOW LOVED</span>
          <span className="want-spark-line">
            You’ve wanted <strong>{wantSpark.place.name}</strong>. {wantSpark.user?.displayName ?? 'A friend'} just loved it.
          </span>
          {wantSpark.note && <span className="want-spark-note">“{wantSpark.note}”</span>}
        </Link>
      )}

      {peopleHere.length > 0 && (
        <section className="friend-feed">
          <p className="eyebrow section-label">YOUR PEOPLE HERE</p>
          <p className="t-small section-sub">Rooms your circle loved, a short walk away.</p>
          {peopleHere.map(({ save }) => (
            <FriendFeedCard key={save.id} save={save} />
          ))}
        </section>
      )}

      {friendItems.length > 0 && (
        <section className="friend-feed">
          <p className="eyebrow section-label">FROM YOUR PEOPLE</p>
          {friendItems.map(save => (
            <FriendFeedCard key={save.id} save={save} />
          ))}
        </section>
      )}

      {signedIn && !stillLoading && !wantSpark && peopleHere.length === 0 && friendItems.length === 0 && (
        <Link to="/settings" className="taste-nudge press">
          <span className="eyebrow">YOUR CIRCLE IS QUIET</span>
          <span className="taste-nudge-line">Invite a few friends to see where they go →</span>
        </Link>
      )}

      {nearby.length > 0 && (
        <>
          <p className="eyebrow section-label scaffold-label">NEARBY &amp; UNEXPLORED</p>
          <Masonry>
            {nearby.map(place => <DiscoverCard key={place.id} place={place} />)}
          </Masonry>
        </>
      )}

      {list.length > 0 && (
        <>
          <p className="eyebrow section-label scaffold-label">ON THE LOW-LIT LIST</p>
          <Masonry>
            {list.map(place => <DiscoverCard key={place.id} place={place} />)}
          </Masonry>
        </>
      )}

      {(nearby.length > 0 || list.length > 0) && (
        <p className="t-small attribution-line">
          place data <span className="google-mark">Google Maps</span>
        </p>
      )}

      {!stillLoading && !anyContent && (
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
