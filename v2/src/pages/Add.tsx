/**
 * ADD A NEW PLACE — the Google autocomplete lane, clearly labeled so it is
 * never confused with library search. Session-tokened (debounce 350ms,
 * ≥3 chars); the details call on selection closes the billing session.
 * Selecting = saving: one tap from suggestion to committed pin + toast.
 *
 * Race rules: a sequence counter invalidates in-flight autocomplete responses
 * whenever the query changes or a selection lands, so stale suggestions can
 * never reappear under an empty input. The session token dies only when a
 * details call actually succeeds (that's what closes the session at Google);
 * a failed details keeps the token so a retry stays in the same session.
 */
import { useEffect, useRef, useState } from 'react'
import {
  autocomplete,
  getDetails,
  newSessionToken,
  placesEnabled,
  type Suggestion,
} from '../lib/places'
import { useSaveFlow } from '../data/queries'
import { gid } from '../data/types'
import { hexFor, neighborhoodFrom } from '../data/vibes'
import { useSession } from '../state/session'
import { showToast } from '../state/toast'
import { signIn } from '../lib/authWatch'
import { haptics } from '../lib/haptics'

export default function Add() {
  const session = useSession()
  const { setTag } = useSaveFlow()
  const [text, setText] = useState('')
  const [suggestions, setSuggestions] = useState<Suggestion[]>([])
  const [busyId, setBusyId] = useState<string | null>(null)
  const token = useRef<string | null>(null)
  const seq = useRef(0)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => inputRef.current?.focus(), [])

  useEffect(() => {
    const mySeq = ++seq.current
    const q = text.trim()
    if (q.length < 3) {
      setSuggestions([])
      return
    }
    const t = setTimeout(async () => {
      token.current ??= newSessionToken()
      const results = await autocomplete(q, token.current)
      if (seq.current === mySeq) setSuggestions(results)
    }, 350)
    return () => clearTimeout(t)
  }, [text])

  const pick = async (s: Suggestion) => {
    if (busyId) return
    haptics.tap()
    setBusyId(s.placeId)
    seq.current++ // kill any in-flight autocomplete response
    try {
      const details = await getDetails(s.placeId, token.current ?? undefined)
      if (details) {
        token.current = null // details succeeded — session closed at Google
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
        setText('')
        setSuggestions([])
      } else {
        haptics.warn()
        showToast({ kind: 'notice', text: "Couldn't fetch that place — try again" })
      }
    } finally {
      setBusyId(null)
      inputRef.current?.focus()
    }
  }

  return (
    <div className="page">
      <header className="page-header">
        <div>
          <p className="eyebrow">ADD A NEW PLACE</p>
          <p className="eyebrow attribution">RESULTS BY GOOGLE</p>
        </div>
      </header>

      {!placesEnabled ? (
        <section className="empty-state">
          <p className="eyebrow">SEARCH IS OFF</p>
          <p className="t-body">
            Place search is disabled in this build (VITE_PLACES_ENABLED). Nothing here will
            pretend to work.
          </p>
        </section>
      ) : session.status === 'signed-out' ? (
        <section className="empty-state">
          <p className="t-body">Sign in to start keeping places.</p>
          <button className="pill pill-primary press" onClick={() => void signIn()}>
            Continue with Google
          </button>
        </section>
      ) : (
        <>
          <input
            ref={inputRef}
            className="add-input"
            placeholder="Name of the place…"
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
          {text.trim().length >= 3 && suggestions.length === 0 && (
            <p className="t-small add-hint">Keep typing — Google needs a few more letters.</p>
          )}
        </>
      )}
    </div>
  )
}
