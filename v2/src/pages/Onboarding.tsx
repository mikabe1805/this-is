/**
 * Onboarding — its only job is to make the first feed prove value:
 *   1. "What do you keep?" — pick ≥3 vibes → seeds the taste vector so ranking
 *      is personalized before you've saved anything.
 *   2. "Add a few places" — the Google lane, so nothing is empty on first open.
 * Finishing writes { onboardedAt, tasteSeed } and drops you on Home.
 *
 * Every step is skippable except a floor of 3 vibes; no dead ends, no confirm
 * dialogs. Signed-out users get sent to sign-in first.
 */
import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import { BROWSE_VIBES, hexFor, neighborhoodFrom } from '../data/vibes'
import { completeOnboarding } from '../data/user'
import { gid } from '../data/types'
import { useSaveFlow } from '../data/queries'
import { useSession } from '../state/session'
import { cachedCoords } from '../lib/geo'
import { cityKeyFrom } from '../data/candidates'
import {
  autocomplete,
  getDetails,
  newSessionToken,
  placesEnabled,
  type Suggestion,
} from '../lib/places'
import { signIn } from '../lib/authWatch'
import { haptics } from '../lib/haptics'

const MIN_VIBES = 3

export default function Onboarding() {
  const session = useSession()
  const navigate = useNavigate()
  const qc = useQueryClient()
  const { setTag } = useSaveFlow()

  const [step, setStep] = useState<1 | 2>(1)
  const [chosen, setChosen] = useState<Set<string>>(new Set())
  const [saved, setSaved] = useState(0)

  // step 2 autocomplete (mirrors Add.tsx: session-tokened, race-guarded)
  const [text, setText] = useState('')
  const [suggestions, setSuggestions] = useState<Suggestion[]>([])
  const [busyId, setBusyId] = useState<string | null>(null)
  const token = useRef<string | null>(null)
  const seq = useRef(0)

  useEffect(() => {
    const mySeq = ++seq.current
    const query = text.trim()
    if (query.length < 3) {
      setSuggestions([])
      return
    }
    const t = setTimeout(async () => {
      token.current ??= newSessionToken()
      const results = await autocomplete(query, token.current)
      if (seq.current === mySeq) setSuggestions(results)
    }, 350)
    return () => clearTimeout(t)
  }, [text])

  if (session.status === 'signed-out') {
    return (
      <div className="page">
        <section className="empty-state">
          <p className="eyebrow">WELCOME</p>
          <h1 className="t-display">First, it needs to be yours.</h1>
          <button className="pill pill-primary press" onClick={() => void signIn()}>
            Continue with Google
          </button>
        </section>
      </div>
    )
  }

  const toggle = (tag: string) => {
    haptics.tap()
    setChosen(prev => {
      const next = new Set(prev)
      next.has(tag) ? next.delete(tag) : next.add(tag)
      return next
    })
  }

  const finish = async () => {
    await completeOnboarding([...chosen], cityKeyFrom(cachedCoords()) ?? undefined)
    void qc.invalidateQueries({ queryKey: ['userDoc'] })
    haptics.success()
    navigate('/home', { replace: true })
  }

  const pick = async (s: Suggestion) => {
    if (busyId) return
    haptics.tap()
    setBusyId(s.placeId)
    seq.current++
    try {
      const details = await getDetails(s.placeId, token.current ?? undefined)
      if (details) {
        token.current = null
        setTag.mutate({
          tag: 'want',
          place: {
            id: gid(details.id),
            name: details.name,
            primaryType: details.primaryType,
            neighborhood: neighborhoodFrom(details.address),
            hex: hexFor(details.primaryType),
            lat: details.lat,
            lng: details.lng,
          },
        })
        setSaved(n => n + 1)
        setText('')
        setSuggestions([])
      }
    } finally {
      setBusyId(null)
    }
  }

  return (
    <div className="page onboarding">
      {step === 1 && (
        <>
          <p className="eyebrow">WELCOME</p>
          <h1 className="t-display onboarding-q">What do you keep?</h1>
          <p className="t-body onboarding-sub">Pick what you’d hang. We’ll light the rest.</p>
          <div className="vibe-grid onboarding-vibes">
            {BROWSE_VIBES.map(v => (
              <button
                key={v.tag}
                className={`vibe-tile eyebrow press${chosen.has(v.tag) ? ' is-on' : ''}`}
                aria-pressed={chosen.has(v.tag)}
                onClick={() => toggle(v.tag)}
              >
                {v.label}
              </button>
            ))}
          </div>
          <div className="onboarding-foot">
            <p className="t-small">{chosen.size}/{MIN_VIBES} chosen</p>
            <button
              className="pill pill-primary press"
              disabled={chosen.size < MIN_VIBES}
              onClick={() => { haptics.select(); setStep(2) }}
            >
              Next
            </button>
          </div>
        </>
      )}

      {step === 2 && (
        <>
          <p className="eyebrow">FEED THE MACHINE</p>
          <h1 className="t-display onboarding-q">Add a few places you already love.</h1>
          <p className="t-body onboarding-sub">
            Even three gives your room something to light on first open.
          </p>

          {placesEnabled ? (
            <>
              <input
                className="add-input"
                placeholder="Name of a place…"
                value={text}
                onChange={e => setText(e.target.value)}
                autoComplete="off"
                autoCorrect="off"
                spellCheck={false}
              />
              <ul className="add-suggestions">
                {suggestions.map(s => (
                  <li key={s.placeId}>
                    <button
                      className={`add-suggestion press${busyId === s.placeId ? ' is-busy' : ''}`}
                      disabled={Boolean(busyId)}
                      onClick={() => void pick(s)}
                    >
                      <span className="add-suggestion-text">{s.text}</span>
                      <span className="eyebrow">{busyId === s.placeId ? 'SAVING…' : 'SAVE'}</span>
                    </button>
                  </li>
                ))}
              </ul>
            </>
          ) : (
            <p className="t-small">Place search is off in this build — you can add places later.</p>
          )}

          <div className="onboarding-foot">
            <p className="t-small">{saved === 0 ? 'none yet' : `${saved} saved`}</p>
            <button className="pill pill-primary press" onClick={() => void finish()}>
              {saved > 0 ? 'Open the room' : 'Skip for now'}
            </button>
          </div>
        </>
      )}
    </div>
  )
}
