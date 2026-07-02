/**
 * THE EVENING HANG — the TONIGHT rail. Horizontally-scrolling go-now cards
 * drawn only from your own WANT pins, closest first. The eyebrow computes real
 * civil dusk from your coords; mood chips relight the rail; the madder GO pill
 * hands off to Google Maps and records the trip for tomorrow's morning-after.
 *
 * Open/closed honesty: the vitals line shows an open claim ONLY when the hours
 * seam returns one. When hours are unknown (the default until the callable
 * ships) the card shows walk time alone — no fabricated "open till". A place
 * the seam reports as closed is dropped from the rail entirely.
 */
import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import type { Pin } from '../data/types'
import { rawPid } from '../data/types'
import {
  filterByMood,
  MOODS,
  tonightCandidates,
  type Mood,
  type TonightCard,
} from '../data/tonight'
import { cachedCoords } from '../lib/geo'
import { tonightEyebrow } from '../lib/sun'
import { mapsDeepLink } from '../lib/places'
import { getHours, openLabel, type HoursMap } from '../lib/hours'
import { recordGo } from '../lib/goEvents'
import { haptics } from '../lib/haptics'
import { PinVisual } from './PinVisual'

export function TonightRail({ pins }: { pins: Pin[] }) {
  const coords = cachedCoords()
  const [mood, setMood] = useState<Mood | null>(null)
  const [hours, setHours] = useState<HoursMap>({})

  const candidates = useMemo(() => tonightCandidates(pins, coords), [pins, coords])

  // Ask the hours seam about this session's candidates (≤10). No-ops to {}
  // when the callable is off — no network, no claim.
  const ids = useMemo(() => candidates.map(c => c.pin.id).join(','), [candidates])
  useEffect(() => {
    let live = true
    if (!ids) return
    void getHours(ids.split(',')).then(h => { if (live) setHours(h) })
    return () => { live = false }
  }, [ids])

  if (!candidates.length) return null

  // Drop only the places the seam actively reports closed; unknown stays.
  const open = candidates.filter(c => hours[c.pin.id]?.openNow !== false)
  const shown = filterByMood(open, mood)
  const eyebrow = tonightEyebrow(coords, new Date())

  return (
    <section className="tonight">
      <p className="eyebrow tonight-eyebrow">{eyebrow}</p>
      <h2 className="t-title tonight-head">You already know where.</h2>

      <div className="tonight-moods" role="group" aria-label="Filter tonight">
        {MOODS.map(m => (
          <button
            key={m.key}
            className={`chip press${mood === m.key ? ' is-on' : ''}`}
            onClick={() => { haptics.tap(); setMood(mood === m.key ? null : m.key) }}
          >
            {m.label}
          </button>
        ))}
      </div>

      {shown.length === 0 ? (
        <p className="t-small tonight-empty">Nothing in that mood is close tonight.</p>
      ) : (
        <div className="tonight-scroller">
          {shown.map(card => (
            <TonightCardView key={card.pin.id} card={card} hoursLabel={openLabel(hours[card.pin.id])} />
          ))}
        </div>
      )}
    </section>
  )
}

function TonightCardView({ card, hoursLabel }: { card: TonightCard; hoursLabel: string | null }) {
  const navigate = useNavigate()
  const { pin, walkMin } = card
  const vitals = [hoursLabel, `${walkMin} MIN WALK`].filter(Boolean).join(' · ')

  const go = (e: React.MouseEvent) => {
    e.stopPropagation()
    haptics.success()
    recordGo(pin.id, pin.snapshot.name)
    window.open(mapsDeepLink(pin.snapshot.name, rawPid(pin.id)), '_blank', 'noopener,noreferrer')
  }

  return (
    <article
      className="tonight-card press"
      role="link"
      tabIndex={0}
      aria-label={pin.snapshot.name}
      onClick={() => navigate(`/p/${pin.id}`)}
      onKeyDown={e => { if (e.key === 'Enter') navigate(`/p/${pin.id}`) }}
    >
      <PinVisual hex={pin.snapshot.hex} alt={pin.snapshot.name} />
      <div className="pin-scrim" aria-hidden />
      <div className="tonight-card-body">
        <h3 className="tonight-card-name">{pin.snapshot.name}</h3>
        <p className="eyebrow tonight-vitals">{vitals}</p>
      </div>
      <button className="pill pill-primary press tonight-go" onClick={go} aria-label={`Go to ${pin.snapshot.name}`}>
        GO
      </button>
    </article>
  )
}
