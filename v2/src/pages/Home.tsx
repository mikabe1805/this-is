/**
 * HOME — the masonry, topped by at most the contextual modules that matter
 * right now, in priority order:
 *   1. Morning-after card (THE HANG) — converts last night's GO into a Been.
 *   2. TONIGHT rail (THE EVENING HANG) — go-now from your own saves, evenings.
 *   3. DISCOVER NEARBY — real places from the seeded city pool you haven't
 *      kept yet, taste+proximity ranked, live budget-gated photos. This is
 *      what keeps the app from being empty on day one.
 * Then your boards, transparently ranked — every card prints its top-scoring
 * factor as the italic reason line.
 */
import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import { useSession } from '../state/session'
import { useCandidates, usePins, useUserDoc } from '../data/queries'
import { tasteFromPins, type Taste } from '../data/taste'
import { rankPins } from '../data/ranking'
import { cachedCoords, walkMinutesBetween, type Coords } from '../lib/geo'
import { Masonry } from '../components/Masonry'
import { PinCard } from '../components/PinCard'
import { DiscoverCard } from '../components/DiscoverCard'
import { MorningAfterCard } from '../components/MorningAfterCard'
import { TonightRail } from '../components/TonightRail'
import { EmptyScene } from '../components/EmptyScene'
import { signIn } from '../lib/authWatch'
import { haptics } from '../lib/haptics'
import type { Pin, PlaceDoc } from '../data/types'

/** Evening through late night in the user's local time. A dogfood override
 *  (`localStorage['this-is:v2:tonight'] = 'always'`) forces it on for testing;
 *  it never fabricates data — the rail is still empty without walkable saves. */
function isEveningNow(): boolean {
  try {
    if (localStorage.getItem('this-is:v2:tonight') === 'always') return true
  } catch {
    /* ignore */
  }
  const h = new Date().getHours()
  return h >= 17 || h < 3
}

/** Taste + proximity over the city pool, minus what you already keep. */
function rankCandidates(
  candidates: PlaceDoc[],
  pins: Pin[],
  taste: Taste,
  coords: Coords | null
): PlaceDoc[] {
  const mine = new Set(pins.map(p => p.id))
  return candidates
    .filter(c => !mine.has(c.id))
    .map(c => {
      let tasteScore = 0
      for (const tag of c.vibeTags ?? []) tasteScore = Math.max(tasteScore, taste[tag] ?? 0)
      const walk = coords
        ? walkMinutesBetween(coords, c.lat, c.lng, c.coordsFetchedAt)
        : null
      const prox = walk === null ? 0 : 1 - Math.min(walk, 60) / 60
      return { place: c, score: tasteScore * 3 + prox * 4 }
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, 8)
    .map(x => x.place)
}

export default function Home() {
  const session = useSession()
  const { data: pins, isLoading } = usePins()
  const { data: userDoc } = useUserDoc()
  const coords = cachedCoords()
  const { data: candidates } = useCandidates(coords)

  const active = useMemo(
    () => (pins ?? []).filter(p => p.status !== 'released'),
    [pins]
  )
  const wantActive = useMemo(() => active.filter(p => p.status === 'want'), [active])

  const taste = useMemo(
    () => tasteFromPins(active, userDoc?.tasteSeed ?? []),
    [active, userDoc?.tasteSeed]
  )
  const ranked = useMemo(() => rankPins(active, taste, coords), [active, taste, coords])
  const discover = useMemo(
    () => rankCandidates(candidates ?? [], active, taste, coords),
    [candidates, active, taste, coords]
  )

  const firstRun = Boolean(userDoc && !userDoc.onboardedAt)
  const signedIn = session.status === 'signed-in'

  const discoverSection = discover.length > 0 && (
    <>
      <p className="eyebrow section-label">DISCOVER NEARBY</p>
      <Masonry>
        {discover.map(place => (
          <DiscoverCard key={place.id} place={place} />
        ))}
      </Masonry>
      <p className="t-small attribution-line">
        Place data: <span className="google-mark">Google Maps</span>
      </p>
    </>
  )

  const locationNudge = !coords && (
    <p className="t-small thin-feed">
      Allow location and nearby places appear here on their own.
    </p>
  )

  return (
    <div className="page">
      <header className="page-header">
        <h1 className="wordmark">this.is</h1>
        {signedIn && (
          <Link to="/add" className="pill pill-ghost press" aria-label="Add a place">
            + Add
          </Link>
        )}
      </header>

      {session.status === 'signed-out' && (
        <>
          <section className="empty-state hero-compact">
            <p className="eyebrow">A PRIVATE VIEW OF YOUR CITY</p>
            <h2 className="t-display">Everything you save is waiting for its light.</h2>
            <button
              className="pill pill-primary press"
              onClick={() => { haptics.tap(); void signIn() }}
            >
              Continue with Google
            </button>
          </section>
          {discoverSection}
          {locationNudge}
        </>
      )}

      {signedIn && (
        <>
          {isLoading && <MasonrySkeleton />}
          {!isLoading && active.length === 0 && (
            <>
              <section className="empty-state hero-compact">
                <EmptyScene />
                <h2 className="t-display">The lights are on. The walls are bare.</h2>
                <p className="t-body">
                  {firstRun
                    ? 'Pick a few things you love — we’ll light the rest.'
                    : 'Keep one place below, or add your own.'}
                </p>
                {firstRun && (
                  <Link to="/onboarding" className="pill pill-primary press">
                    Set up your room
                  </Link>
                )}
              </section>
              {discoverSection}
              {locationNudge}
            </>
          )}
          {!isLoading && active.length > 0 && (
            <>
              <MorningAfterCard pins={active} />
              {isEveningNow() && <TonightRail pins={wantActive} />}
              {discoverSection}
              <p className="eyebrow section-label">FROM YOUR BOARDS</p>
              <Masonry>
                {ranked.map(({ pin, reason }) => (
                  <PinCard key={pin.id} pin={pin} reason={reason} />
                ))}
              </Masonry>
            </>
          )}
        </>
      )}

      {session.status === 'unknown' && <MasonrySkeleton />}
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
