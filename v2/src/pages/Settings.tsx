/**
 * Settings — small and real. Every control here works; dead toggles are
 * banned (they were half the "buggy feeling" of v1).
 */
import { useState } from 'react'
import { useSession } from '../state/session'
import { signIn, signOutUser } from '../lib/authWatch'
import { haptics } from '../lib/haptics'

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
