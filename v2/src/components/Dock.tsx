/**
 * The three-tab dock — the app's only persistent chrome. Glass recipe lives
 * on `.dock` (chrome-only glass law).
 */
import { NavLink } from 'react-router-dom'
import { haptics } from '../lib/haptics'
import { useSession } from '../state/session'

const TABS = [
  { to: '/together', label: 'TOGETHER', icon: TogetherIcon },
  { to: '/saved', label: 'KEEP', icon: SavedIcon },
  { to: '/people', label: 'PEOPLE', icon: PeopleIcon },
] as const

export function Dock() {
  const session = useSession()
  if (session.status !== 'signed-in') return null

  return (
    <nav className="dock glass-chrome" aria-label="Primary">
      {TABS.map(({ to, label, icon: Icon }) => (
        <NavLink
          key={to}
          to={to}
          onClick={() => haptics.tap()}
          className={({ isActive }) => `dock-tab press${isActive ? ' is-active' : ''}`}
        >
          <Icon />
          <span className="dock-label">{label}</span>
        </NavLink>
      ))}
    </nav>
  )
}

function TogetherIcon() {
  return (
    <svg className="dock-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
      <circle cx="8" cy="12" r="5" />
      <circle cx="16" cy="12" r="5" />
    </svg>
  )
}

function PeopleIcon() {
  return (
    <svg className="dock-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
      <circle cx="9" cy="8" r="3" />
      <circle cx="17" cy="9" r="2.4" />
      <path d="M3.5 20c.4-4 2.2-6 5.5-6s5.1 2 5.5 6M14 15c3.8-.5 5.7 1.2 6.2 4.5" strokeLinecap="round" />
    </svg>
  )
}

function SavedIcon() {
  return (
    <svg className="dock-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
      <path d="M7 3.5h10a1 1 0 0 1 1 1V21l-6-4-6 4V4.5a1 1 0 0 1 1-1Z" strokeLinejoin="round" />
    </svg>
  )
}
