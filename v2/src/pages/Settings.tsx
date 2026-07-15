/**
 * Settings â€” small and real. Every control here works; dead toggles are
 * banned (they were half the "buggy feeling" of v1).
 *
 * Group membership and invitations live in Together, where their audience is
 * visible. Settings only points there instead of creating a second social model.
 */
import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import { useSession } from '../state/session'
import { useUserDoc } from '../data/queries'
import { updateProfile, avatarHexFor, AVATAR_PALETTE, type UserDoc } from '../data/user'
import { signIn, signOutUser } from '../lib/authWatch'
import { haptics } from '../lib/haptics'
import { Avatar } from '../components/Avatar'
import { DataAndAccount } from '../components/DataAndAccount'
import { prototypeFailure, prototypeKind } from '../lib/prototypeMode'

const THEME_KEY = 'this-is:v2:theme'
const HAPTICS_KEY = 'this-is:haptics'
type ProfilePatch = { displayName?: string; avatarHex?: string }

const prototypeProfileStorageKey = (uid: string) => `__this_is_profile:${uid}`

function currentTheme(): 'night' | 'day' {
  try {
    return localStorage.getItem(THEME_KEY) === 'day' ? 'day' : 'night'
  } catch {
    return 'night'
  }
}
function hapticsEnabled(): boolean {
  try {
    return localStorage.getItem(HAPTICS_KEY) !== 'false'
  } catch {
    return true
  }
}

export default function Settings() {
  const session = useSession()
  const [theme, setTheme] = useState<'night' | 'day'>(currentTheme)
  const [buzz, setBuzz] = useState(hapticsEnabled)

  const toggleTheme = () => {
    const next = theme === 'night' ? 'day' : 'night'
    setTheme(next)
    try { localStorage.setItem(THEME_KEY, next) } catch { /* ignore */ }
    document.documentElement.dataset.theme = next
    haptics.tap()
  }

  const toggleHaptics = () => {
    const next = !buzz
    setBuzz(next)
    haptics.setEnabled(next)
    if (next) haptics.select()
  }

  return (
    <div className="page">
      <header className="page-header">
        <h1 className="eyebrow">SETTINGS</h1>
      </header>

      {session.status === 'signed-in' && <Profile uid={session.user.uid} />}
      {session.status === 'signed-in' && <YourPeople />}
      {session.status === 'signed-in' && (
        <DataAndAccount key={session.user.uid} uid={session.user.uid} />
      )}

      <ul className="settings-list">
        <li className="settings-row">
          <span className="t-body">Theme</span>
          <button
            className="pill pill-ghost press"
            aria-label={`Theme: ${theme}. Switch to ${theme === 'night' ? 'day' : 'night'}.`}
            onClick={toggleTheme}
          >
            {theme === 'night' ? 'Night' : 'Day'}
          </button>
        </li>
        <li className="settings-row">
          <span className="t-body">Haptics</span>
          <button
            className="pill pill-ghost press"
            aria-label="Haptics"
            aria-pressed={buzz}
            onClick={toggleHaptics}
          >
            {buzz ? 'On' : 'Off'}
          </button>
        </li>
        <li className="settings-row">
          {session.status === 'signed-in' ? (
            <>
              <span className="t-body">{session.user.displayName ?? 'Signed in'}</span>
              <button className="pill pill-ghost press" onClick={() => void signOutUser()}>
                Sign out
              </button>
            </>
          ) : (
            <>
              <span className="t-body">Not signed in</span>
              <button className="pill pill-primary press" onClick={() => void signIn()}>
                Continue with Google
              </button>
            </>
          )}
        </li>
      </ul>

      <footer className="settings-foot legal-links">
        <Link to="/terms">Terms</Link>
        <Link to="/privacy">Privacy</Link>
        <span className="gmp-attribution" translate="no">Google Maps</span>
      </footer>
    </div>
  )
}

function Profile({ uid }: { uid: string }) {
  const qc = useQueryClient()
  const { data: userDoc } = useUserDoc()
  const prototype = prototypeKind() === 'group'
  const savedName = userDoc?.displayName ?? ''
  const avatarHex = userDoc?.avatarHex ?? avatarHexFor(uid)

  const [name, setName] = useState(savedName)
  const [profileBusy, setProfileBusy] = useState(false)
  const [profileRecovery, setProfileRecovery] = useState<ProfilePatch | null>(null)
  const dirty = useRef(false)
  const responseLost = useRef(false)
  const recoveryButtonRef = useRef<HTMLButtonElement>(null)
  useEffect(() => { if (!dirty.current) setName(savedName) }, [savedName])
  useLayoutEffect(() => {
    if (!profileRecovery || profileBusy) return
    const button = recoveryButtonRef.current
    if (button && !button.disabled) button.focus()
  }, [profileBusy, profileRecovery])

  const persist = async (p: ProfilePatch) => {
    if (!prototype) {
      await updateProfile(p)
      return
    }

    const key = prototypeProfileStorageKey(uid)
    const raw = window.sessionStorage.getItem(key)
    let stored: (UserDoc & { committedAt?: number }) | null = null
    try { stored = raw ? JSON.parse(raw) as UserDoc & { committedAt?: number } : null } catch { /* replace malformed fixture state */ }
    const exact = stored && Object.entries(p).every(([field, value]) => stored?.[field as keyof UserDoc] === value)
    const next = { ...(qc.getQueryData<UserDoc>(['userDoc', uid]) ?? {}), ...p }
    if (!exact) window.sessionStorage.setItem(key, JSON.stringify({ ...next, committedAt: Date.now() }))
    qc.setQueryData<UserDoc>(['userDoc', uid], next)
    if (prototypeFailure('profile-save-response') && !responseLost.current) {
      responseLost.current = true
      throw new Error('prototype ambiguous profile response')
    }
  }

  const patch = async (p: ProfilePatch) => {
    if (profileBusy) return
    const prev = qc.getQueryData<UserDoc>(['userDoc', uid])
    setProfileBusy(true)
    qc.setQueryData<UserDoc>(['userDoc', uid], d => ({ ...(d ?? {}), ...p }))
    try {
      await persist(p)
      setProfileRecovery(null)
      if (!prototype) void qc.invalidateQueries({ queryKey: ['userDoc'] })
    } catch {
      qc.setQueryData<UserDoc>(['userDoc', uid], prev)
      if (p.displayName) setName(prev?.displayName ?? savedName)
      setProfileRecovery(p)
      haptics.warn()
    } finally {
      setProfileBusy(false)
    }
  }

  const commitName = () => {
    if (!dirty.current || profileBusy || profileRecovery) return
    dirty.current = false
    const trimmed = name.trim()
    if (!trimmed || trimmed === savedName) { setName(savedName); return }
    void patch({ displayName: trimmed })
  }

  const setColor = (hex: string) => {
    if (hex === avatarHex || profileBusy || profileRecovery) return
    haptics.tap()
    void patch({ avatarHex: hex })
  }

  const locked = profileBusy || Boolean(profileRecovery)
  const recoveryDescription = profileRecovery?.displayName
    ? `your name changed to “${profileRecovery.displayName}”`
    : 'your avatar changed to the selected color'

  return (
    <section className="you-profile" aria-label="Your profile">
      <p className="eyebrow section-label">YOU</p>
      {profileRecovery && (
        <div className="closeup-data-warning" role="alert" aria-label="Profile change not confirmed">
          <span>
            <strong className="t-row-title">Profile change not confirmed.</strong>
            <span className="t-small">
              Your profile still shows its last confirmed state. We couldn’t confirm whether {recoveryDescription}. Checking again repeats only that exact change; it cannot change your groups or Keep.
            </span>
          </span>
          <button
            ref={recoveryButtonRef}
            className="pill pill-primary press"
            disabled={profileBusy}
            onClick={() => void patch(profileRecovery)}
          >{profileBusy ? 'Checking…' : 'Check profile'}</button>
        </div>
      )}
      <div className="you-head">
        <Avatar name={name || 'You'} hex={avatarHex} size={48} />
        <input
          className="add-input you-name"
          value={name}
          onChange={e => { dirty.current = true; setName(e.target.value) }}
          onBlur={commitName}
          placeholder="Your name"
          aria-label="Your name"
          maxLength={30}
          disabled={locked}
        />
      </div>
      <div className="avatar-swatches" role="group" aria-label="Avatar color">
        {AVATAR_PALETTE.map(hex => (
          <button
            key={hex}
            className={`avatar-swatch press${avatarHex === hex ? ' is-on' : ''}`}
            style={{ background: hex }}
            aria-label={`Avatar color ${hex}`}
            aria-pressed={avatarHex === hex}
            disabled={locked}
            onClick={() => setColor(hex)}
          />
        ))}
      </div>
    </section>
  )
}

function YourPeople() {
  return (
    <section className="your-people">
      <p className="eyebrow section-label">YOUR GROUPS</p>
      <Link className="pill pill-primary press invite-copy" to="/together">Manage in Together</Link>
      <p className="t-small invite-hint">
        Create invitations inside a group, where you can see exactly who will share its taste evidence.
      </p>
    </section>
  )
}
