/**
 * HOME — the masonry, topped by at most the contextual modules that matter
 * right now, in priority order:
 *   1. Morning-after card (THE HANG) — converts last night's GO into a Been.
 *   2. TONIGHT rail (THE EVENING HANG) — go-now from your own saves, evenings.
 * Then your boards, transparently ranked (data/ranking.ts): every card prints
 * its top-scoring factor as the italic reason line. Discovery from the city
 * candidate pool lands when a composer/pool exists — until then the feed is
 * honestly your-saves-only, and the thin-feed line says so.
 */
import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import { useSession } from '../state/session'
import { usePins, useUserDoc } from '../data/queries'
import { tasteFromPins } from '../data/taste'
import { rankPins } from '../data/ranking'
import { cachedCoords } from '../lib/geo'
import { Masonry } from '../components/Masonry'
import { PinCard } from '../components/PinCard'
import { MorningAfterCard } from '../components/MorningAfterCard'
import { TonightRail } from '../components/TonightRail'
import { EmptyScene } from '../components/EmptyScene'
import { signIn } from '../lib/authWatch'
import { haptics } from '../lib/haptics'

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

export default function Home() {
  const session = useSession()
  const { data: pins, isLoading } = usePins()
  const { data: userDoc } = useUserDoc()

  const active = useMemo(
    () => (pins ?? []).filter(p => p.status !== 'released'),
    [pins]
  )
  const wantActive = useMemo(() => active.filter(p => p.status === 'want'), [active])

  const ranked = useMemo(() => {
    const taste = tasteFromPins(active, userDoc?.tasteSeed ?? [])
    return rankPins(active, taste, cachedCoords())
  }, [active, userDoc?.tasteSeed])

  const firstRun = Boolean(userDoc && !userDoc.onboardedAt)

  return (
    <div className="page">
      <header className="page-header">
        <h1 className="wordmark">this.is</h1>
        {session.status === 'signed-in' && (
          <Link to="/add" className="pill pill-ghost press" aria-label="Add a place">
            + Add
          </Link>
        )}
      </header>

      {session.status === 'signed-out' && (
        <section className="empty-state">
          <p className="eyebrow">A PRIVATE VIEW OF YOUR CITY</p>
          <h2 className="t-display">Everything you save is waiting for its light.</h2>
          <p className="t-body">One tap to save a place. One glance to know where tonight.</p>
          <button
            className="pill pill-primary press"
            onClick={() => { haptics.tap(); void signIn() }}
          >
            Continue with Google
          </button>
        </section>
      )}

      {session.status === 'signed-in' && (
        <>
          {isLoading && <MasonrySkeleton />}
          {!isLoading && active.length === 0 && (
            <section className="empty-state">
              <EmptyScene />
              <h2 className="t-display">The lights are on. The walls are bare.</h2>
              <p className="t-body">
                {firstRun
                  ? 'Pick a few things you love — we’ll light the rest.'
                  : 'Save one place today. Collections start with one.'}
              </p>
              <Link
                to={firstRun ? '/onboarding' : '/add'}
                className="pill pill-primary press"
              >
                {firstRun ? 'Set up your room' : 'Find your first'}
              </Link>
            </section>
          )}
          {!isLoading && active.length > 0 && (
            <>
              <MorningAfterCard pins={active} />
              {isEveningNow() && <TonightRail pins={wantActive} />}
              <p className="eyebrow section-label">FROM YOUR BOARDS</p>
              <Masonry>
                {ranked.map(({ pin, reason }) => (
                  <PinCard key={pin.id} pin={pin} reason={reason} />
                ))}
              </Masonry>
              {active.length < 6 && (
                <p className="t-small thin-feed">
                  Your city is still filling in. Every place you save sharpens what surfaces here.
                </p>
              )}
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
