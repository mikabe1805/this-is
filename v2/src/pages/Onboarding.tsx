/**
 * Onboarding — three quick steps, each one earning the first feed:
 *   1. "Who are you?" — name + avatar color. This is how friends recognize you
 *      in the feed, so it comes first (FRIENDS.md task 1: handles + avatar).
 *   2. "What do you keep?" — pick ≥3 vibes → seeds the taste vector so ranking
 *      is personalized before you've saved anything.
 *   3. "Add a few places" — the Google lane, so nothing is empty on first open.
 * Finishing writes { onboardedAt, tasteSeed } (identity is written at step 1)
 * and drops you on Home.
 *
 * Every step is skippable except a name + a floor of 3 vibes; no dead ends, no
 * confirm dialogs. Signed-out users get sent to sign-in first.
 */
import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import { BROWSE_VIBES, hexFor, neighborhoodFrom } from '../data/vibes'
import { completeOnboarding, updateProfile, avatarHexFor, AVATAR_PALETTE, type UserDoc } from '../data/user'
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
import { Avatar } from '../components/Avatar'

const MIN_VIBES = 3

export default function Onboarding() {
  const session = useSession()
  const navigate = useNavigate()
  const qc = useQueryClient()
  const { setTag } = useSaveFlow()

  const [step, setStep] = useState<1 | 2 | 3>(1)

  // step 1 — identity
  const [name, setName] = useState('')
  const [avatarHex, setAvatarHex] = useState('')
  const touched = useRef(false)
  useEffect(() => {
    if (session.status !== 'signed-in') return
    // `touched` guards only the NAME (don't clobber what they typed); the avatar
    // always prefills when still empty, so the preview, the selected swatch, and
    // the persisted color agree even if auth resolves after they start typing.
    if (!touched.current) setName(prev => prev || session.user.displayName || '')
    setAvatarHex(prev => prev || avatarHexFor(session.user.uid))
  }, [session])

  // step 2 — vibes
  const [chosen, setChosen] = useState<Set<string>>(new Set())

  // step 3 — add places (session-tokened autocomplete, mirrors Add.tsx)
  const [saved, setSaved] = useState(0)
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

  const saveIdentity = () => {
    haptics.select()
    void updateProfile({ displayName: name, avatarHex })
    setStep(2)
  }

  const finish = async () => {
    // Identity was written at step 1, but write it once more in case it changed.
    void updateProfile({ displayName: name, avatarHex })
    await completeOnboarding([...chosen], cityKeyFrom(cachedCoords()) ?? undefined)
    // Seed the cache synchronously so the OnboardingGate on /home sees the new
    // name/avatar and onboardedAt immediately and can't bounce us back.
    const uid = session.status === 'signed-in' ? session.user.uid : null
    if (uid) {
      qc.setQueryData<UserDoc>(['userDoc', uid], d => ({
        ...(d ?? {}),
        onboardedAt: Date.now(),
        ...(name.trim() ? { displayName: name.trim() } : {}),
        ...(avatarHex ? { avatarHex } : {}),
      }))
    }
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
          <h1 className="t-display onboarding-q">Who are you?</h1>
          <p className="t-body onboarding-sub">This is how your friends will spot you.</p>
          <div className="identity-preview">
            <Avatar name={name || 'You'} hex={avatarHex || AVATAR_PALETTE[0]} size={72} />
          </div>
          <input
            className="add-input"
            placeholder="Your name"
            value={name}
            onChange={e => { touched.current = true; setName(e.target.value) }}
            autoComplete="off"
            maxLength={30}
            aria-label="Your name"
          />
          <div className="avatar-swatches" role="group" aria-label="Avatar color">
            {AVATAR_PALETTE.map(hex => (
              <button
                key={hex}
                className={`avatar-swatch press${avatarHex === hex ? ' is-on' : ''}`}
                style={{ background: hex }}
                aria-label={`Avatar color ${hex}`}
                aria-pressed={avatarHex === hex}
                onClick={() => { haptics.tap(); touched.current = true; setAvatarHex(hex) }}
              />
            ))}
          </div>
          <div className="onboarding-foot">
            <span />
            <button className="pill pill-primary press" disabled={!name.trim()} onClick={saveIdentity}>
              Next
            </button>
          </div>
        </>
      )}

      {step === 2 && (
        <>
          <p className="eyebrow">YOUR TASTE</p>
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
              onClick={() => { haptics.select(); setStep(3) }}
            >
              Next
            </button>
          </div>
        </>
      )}

      {step === 3 && (
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
