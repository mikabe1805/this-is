/**
 * HOME — the discovery feed, and the whole product (DIRECTION.md).
 *
 * A hand-curated, taste-ranked feed of the low-lit going-out rooms worth
 * leaving the house for. Cards lead with the curator's POV; ranking re-orders
 * an already-great editorial set by your chosen vibes + proximity. No boards,
 * no TONIGHT rail, no morning-after — discovery is the entire surface.
 */
import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import { useSession } from '../state/session'
import { useCurated, usePins, useUserDoc } from '../data/queries'
import { tasteFromPins, type Taste } from '../data/taste'
import { walkMinutesBetween, type Coords } from '../lib/geo'
import { cachedCoords } from '../lib/geo'
import { Masonry } from '../components/Masonry'
import { DiscoverCard } from '../components/DiscoverCard'
import { EmptyScene } from '../components/EmptyScene'
import { signIn } from '../lib/authWatch'
import { haptics } from '../lib/haptics'
import type { Pin, PlaceDoc } from '../data/types'

const LAUNCH_CITY_LABEL = 'NEW YORK'

/** Taste + proximity over the curated set, minus what you already keep. Every
 *  curated card is already good; this just orders it toward you. */
function rankCurated(
  catalog: PlaceDoc[],
  pins: Pin[],
  taste: Taste,
  coords: Coords | null
): PlaceDoc[] {
  const mine = new Set(pins.map(p => p.id))
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
  const { data: curated, isLoading } = useCurated()
  const { data: pins } = usePins()
  const { data: userDoc } = useUserDoc()
  const coords = cachedCoords()

  const active = useMemo(() => (pins ?? []).filter(p => p.status !== 'released'), [pins])
  const taste = useMemo(
    () => tasteFromPins(active, userDoc?.tasteSeed ?? []),
    [active, userDoc?.tasteSeed]
  )
  const feed = useMemo(
    () => rankCurated(curated ?? [], active, taste, coords),
    [curated, active, taste, coords]
  )

  const firstRun = session.status === 'signed-in' && Boolean(userDoc && !userDoc.onboardedAt)

  return (
    <div className="page">
      <header className="masthead">
        <h1 className="wordmark">this.is</h1>
        <p className="eyebrow masthead-scene">{LAUNCH_CITY_LABEL} · THE LOW-LIT LIST</p>
        <p className="masthead-sub">
          The intimate rooms worth leaving the house for — not the 2,000-review default.
        </p>
      </header>

      {firstRun && (
        <Link to="/onboarding" className="taste-nudge press">
          <span className="eyebrow">30 SECONDS</span>
          <span className="taste-nudge-line">Tell us what you’d hang around for →</span>
        </Link>
      )}

      {isLoading && <MasonrySkeleton />}

      {!isLoading && feed.length === 0 && (
        <section className="empty-state">
          <EmptyScene />
          <h2 className="t-display">The list isn’t lit here yet.</h2>
          <p className="t-body">We’re curating {LAUNCH_CITY_LABEL} first. More cities soon.</p>
        </section>
      )}

      {!isLoading && feed.length > 0 && (
        <>
          <Masonry>
            {feed.map(place => (
              <DiscoverCard key={place.id} place={place} />
            ))}
          </Masonry>
          <p className="t-small attribution-line">
            Curated in {LAUNCH_CITY_LABEL} · place data <span className="google-mark">Google Maps</span>
          </p>
        </>
      )}

      {session.status === 'signed-out' && (
        <div className="signin-foot glass-chrome">
          <p className="t-small">Save the ones you want, and the list learns your taste.</p>
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
