/**
 * Settings — small and real. Every control here works; dead toggles are
 * banned (they were half the "buggy feeling" of v1).
 *
 * "Your people" is the friend-graph's front door (v2/FRIENDS.md): copy your
 * invite link so a friend opening it follows you both ways, and prune whom you
 * see — the auto-followed tastemakers are removable here, as promised.
 */
import { useEffect, useRef, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useSession } from '../state/session'
import { useUserDoc } from '../data/queries'
import { fetchUsers, unfollow, updateProfile, avatarHexFor, AVATAR_PALETTE, type UserDoc } from '../data/user'
import { signIn, signOutUser } from '../lib/authWatch'
import { haptics } from '../lib/haptics'
import { showToast } from '../state/toast'
import { Avatar } from '../components/Avatar'

const THEME_KEY = 'this-is:v2:theme'
const HAPTICS_KEY = 'this-is:haptics'

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
        <p className="eyebrow">SETTINGS</p>
      </header>

      {session.status === 'signed-in' && <Profile uid={session.user.uid} />}
      {session.status === 'signed-in' && <YourPeople uid={session.user.uid} />}

      <ul className="settings-list">
        <li className="settings-row">
          <span className="t-body">Theme</span>
          <button className="pill pill-ghost press" onClick={toggleTheme}>
            {theme === 'night' ? 'Night' : 'Day'}
          </button>
        </li>
        <li className="settings-row">
          <span className="t-body">Haptics</span>
          <button className="pill pill-ghost press" onClick={toggleHaptics}>
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

      <p className="eyebrow attribution settings-foot">PLACE DATA BY GOOGLE</p>
    </div>
  )
}

function Profile({ uid }: { uid: string }) {
  const qc = useQueryClient()
  const { data: userDoc } = useUserDoc()
  const savedName = userDoc?.displayName ?? ''
  const avatarHex = userDoc?.avatarHex ?? avatarHexFor(uid)

  const [name, setName] = useState(savedName)
  const dirty = useRef(false)
  useEffect(() => { if (!dirty.current) setName(savedName) }, [savedName])

  const patch = (p: { displayName?: string; avatarHex?: string }) => {
    // Optimistic: the Avatar + swatches read from the cache, so reflect the
    // change now, then persist; revert + warn if the write fails.
    const prev = qc.getQueryData<UserDoc>(['userDoc', uid])
    qc.setQueryData<UserDoc>(['userDoc', uid], d => ({ ...(d ?? {}), ...p }))
    void updateProfile(p)
      .then(() => qc.invalidateQueries({ queryKey: ['userDoc'] }))
      .catch(() => {
        qc.setQueryData<UserDoc>(['userDoc', uid], prev)
        haptics.warn()
        showToast({ kind: 'notice', text: "Couldn't save — try again" })
      })
  }

  const commitName = () => {
    if (!dirty.current) return
    dirty.current = false
    const trimmed = name.trim()
    if (!trimmed || trimmed === savedName) { setName(savedName); return }
    patch({ displayName: trimmed })
  }

  const setColor = (hex: string) => {
    if (hex === avatarHex) return
    haptics.tap()
    patch({ avatarHex: hex })
  }

  return (
    <section className="you-profile">
      <p className="eyebrow section-label">YOU</p>
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
            onClick={() => setColor(hex)}
          />
        ))}
      </div>
    </section>
  )
}

function YourPeople({ uid }: { uid: string }) {
  const qc = useQueryClient()
  const { data: userDoc } = useUserDoc()
  const following = userDoc?.following ?? []
  const [copied, setCopied] = useState(false)

  const { data: people } = useQuery({
    queryKey: ['followingUsers', following],
    enabled: following.length > 0,
    staleTime: 5 * 60_000,
    queryFn: () => fetchUsers(following),
  })

  const inviteLink = `${window.location.origin}/i/${uid}`

  const copy = async () => {
    haptics.tap()
    try {
      await navigator.clipboard.writeText(inviteLink)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // Clipboard blocked (insecure context / permissions) — surface the link
      // so it can still be copied by hand rather than silently failing.
      window.prompt('Copy your invite link', inviteLink)
    }
  }

  const drop = async (otherUid: string) => {
    haptics.tap()
    await unfollow(otherUid)
    void qc.invalidateQueries({ queryKey: ['userDoc'] })
    void qc.invalidateQueries({ queryKey: ['friendFeed'] })
  }

  return (
    <section className="your-people">
      <p className="eyebrow section-label">YOUR PEOPLE</p>
      <button className="pill pill-primary press invite-copy" onClick={() => void copy()}>
        {copied ? 'Link copied ✓' : 'Copy your invite link'}
      </button>
      <p className="t-small invite-hint">
        Whoever opens it sees where you go — and you see them.
      </p>

      {following.length > 0 && (
        <ul className="people-list">
          {(people ?? following.map(u => ({ uid: u, displayName: 'Someone', avatarHex: '#5A6B8E' }))).map(p => (
            <li key={p.uid} className="people-row">
              <Avatar name={p.displayName} hex={p.avatarHex} size={32} />
              <span className="people-name t-body">{p.displayName}</span>
              <button className="toast-ghost press" onClick={() => void drop(p.uid)}>
                remove
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
